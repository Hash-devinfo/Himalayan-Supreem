import mongoose from 'mongoose';
import Customer from '../../models/Customer.js';
import City, { CITY_COLLATION } from '../../models/City.js';
import Variant from '../../models/Variant.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { calculateDelivery, resolveCity } from '../delivery/quote.service.js';
import { changeOrder } from './order.service.js';
import { CANCELLABLE, statusLabel } from './orderStatus.js';
import type { UpdateContactInput } from './contact.validation.js';

// Correct the delivery address and contact details before packing (requirements 4.3).
// Every change is recorded in the audit log with the old and new values.
export async function updateContact(idOrNumber: string, input: UpdateContactInput, actor: ActorContext) {
  // Reading the city list needs no transaction; do it first
  const city = input.address ? await resolveCity(input.address) : null;

  return changeOrder(idOrNumber, async (order, session) => {
    if (!CANCELLABLE.includes(order.status)) {
      throw new AppError(`The address and contact can only be changed before packing (this order is "${statusLabel(order.status)}")`, 409);
    }

    const c = order.customerSnapshot;
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const change = (field: string, oldValue: unknown, newValue: unknown) => {
      if (oldValue === newValue) return false;
      before[field] = oldValue ?? null;
      after[field] = newValue ?? null;
      return true;
    };

    if (input.name !== undefined && change('name', c.name, input.name)) c.name = input.name;

    if (input.email !== undefined && change('email', c.email, input.email ?? undefined)) {
      c.email = input.email ?? undefined;
    }

    // A new phone = a different customer: move the order to that customer's history
    if (input.phone !== undefined && change('phone', c.phone, input.phone)) {
      const newCustomer = await Customer.findOneAndUpdate(
        { phone: input.phone },
        { $set: { name: c.name }, $inc: { 'stats.orderCount': 1 } },
        { upsert: true, returnDocument: 'after', session }
      );
      if (!newCustomer) throw new Error('Customer could not be saved');
      await Customer.updateOne({ _id: order.customer }, { $inc: { 'stats.orderCount': -1 } }, { session });
      order.customer = newCustomer._id;
      c.phone = input.phone;
    }

    let delivery: { agreedCharge: number; newCityCharge: number; zone: string; estimate: string; applied: boolean } | null = null;

    if (input.address && city) {
      const a = input.address;
      // Read each field by name: spreading a Mongoose sub-document ({ ...c.address }) does NOT copy its fields
      const oldAddress = { line1: c.address.line1, line2: c.address.line2, area: c.address.area, city: c.address.city, province: c.address.province };

      // A typed city joins the list (source "customer"), as at checkout
      let cityRef = city.id ?? undefined;
      if (!city.listed) {
        const saved = await City.findOneAndUpdate(
          { name: city.name, province: city.province },
          { $setOnInsert: { name: city.name, province: city.province, source: 'customer', isBlocked: false, sortOrder: 100 } },
          { upsert: true, returnDocument: 'after', collation: CITY_COLLATION, session }
        );
        cityRef = saved?.id;
      }

      const newAddress = {
        line1: a.line1,
        line2: a.line2 || undefined,
        area: a.area || undefined,
        city: city.name,
        cityRef: cityRef ? new mongoose.Types.ObjectId(cityRef) : undefined,
        cityUnlisted: !city.listed,
        province: city.province,
      };
      const changed = (['line1', 'line2', 'area', 'city', 'province'] as const).filter((k) => (oldAddress[k] ?? null) !== (newAddress[k] ?? null));
      for (const k of changed) change(`address.${k}`, oldAddress[k], newAddress[k]);
      if (changed.length > 0) {
        c.address = newAddress;
        order.flags.unlistedCity = !city.listed;
      }

      // The new city may have a different delivery charge. Shipping weights come from the sizes.
      const variants = await Variant.find({ _id: mongoose.trusted({ $in: order.items.map((i) => i.variant) }) } as Record<string, unknown>)
        .select('shippingWeightGrams')
        .session(session)
        .lean();
      const weight = order.items.reduce((sum, i) => {
        const v = variants.find((x) => String(x._id) === String(i.variant));
        return sum + (v?.shippingWeightGrams ?? 0) * i.qty;
      }, 0);
      const quote = await calculateDelivery(city, weight, order.pricing.subtotal);
      if (!quote.available) throw new AppError(quote.message, 400);

      const agreed = order.pricing.deliveryCharge;
      delivery = { agreedCharge: agreed, newCityCharge: quote.charge, zone: quote.zone, estimate: quote.estimateText, applied: false };

      if (input.recalculateDelivery) {
        change('pricing.deliveryCharge', agreed, quote.charge);
        order.pricing.deliveryCharge = quote.charge;
        order.pricing.total = order.pricing.subtotal - order.pricing.discountTotal + quote.charge;
        order.deliveryZone = { zone: new mongoose.Types.ObjectId(quote.zoneId), name: quote.zone, estimateText: quote.estimateText };
        delivery.applied = true;
      }
    }

    if (Object.keys(after).length === 0) {
      return { order, changed: false, delivery };
    }

    await order.save({ session });
    await recordAudit(
      {
        admin: actor.adminId,
        action: 'order.contact_update',
        entityType: 'Order',
        entityId: order.id,
        before,
        after: { ...after, ...(input.note ? { note: input.note } : {}) },
        ip: actor.ip,
      },
      session
    );
    return { order, changed: true, delivery };
  });
}
import mongoose from "mongoose";
import Order, {
  type OrderDocument,
  type OrderItem,
} from "../../models/Order.js";
import Customer from "../../models/Customer.js";
import Cart from "../../models/Cart.js";
import City, { CITY_COLLATION } from "../../models/City.js";
import AppError from "../../utils/AppError.js";
import { formatPkMobile } from "../../utils/phone.js";
import { getCart } from "../cart/cart.service.js";
import { calculateDelivery, resolveCity } from "../delivery/quote.service.js";
import { getSettings } from "../settings/settings.service.js";
import { reserveStock, StockShortError } from "../inventory/stock.service.js";
import { nextOrderNumber } from "./orderNumber.js";
import { notifyOrder } from "../notifications/notification.service.js";
import type { CheckoutInput } from "./checkout.validation.js";
import {
  assertDailyLimit,
  assertNotBlocked,
} from "../customers/risk.service.js";
import { startPayment } from "../../providers/payments/index.js";

// ── What the customer sees after ordering ────────────

export interface OrderConfirmation {
  orderNumber: string;
  status: string;
  placedAt: Date;
  customer: { name: string; phone: string; email?: string };
  address: {
    line1: string;
    line2?: string;
    area?: string;
    city: string;
    province: string;
  };
  items: {
    name: string;
    variantLabel: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }[];
  pricing: {
    subtotal: number;
    discountTotal: number;
    deliveryCharge: number;
    total: number;
  };
  delivery: { estimateText: string };
  paymentMethod: string;
}

function toConfirmation(order: OrderDocument): OrderConfirmation {
  const { customerSnapshot: c } = order;
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt,
    customer: { name: c.name, phone: formatPkMobile(c.phone), email: c.email },
    address: {
      line1: c.address.line1,
      line2: c.address.line2,
      area: c.address.area,
      city: c.address.city,
      province: c.address.province,
    },
    items: order.items.map((i) => ({
      name: i.name,
      variantLabel: i.variantLabel,
      qty: i.qty,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
    pricing: {
      subtotal: order.pricing.subtotal,
      discountTotal: order.pricing.discountTotal,
      deliveryCharge: order.pricing.deliveryCharge,
      total: order.pricing.total,
    },
    delivery: { estimateText: order.deliveryZone.estimateText },
    paymentMethod: order.payment.method,
  };
}

// ── Place an order (guest, cash on delivery) ─────────

export async function placeOrder(
  sessionId: string | undefined,
  input: CheckoutInput,
): Promise<OrderConfirmation> {
  // 0. Fake-order protection: a blocked number is asked to order on WhatsApp instead (BR-16)
  await assertNotBlocked(input.phone);
  const payment = startPayment(input.paymentMethod);
  // 1. Re-check the cart (published, active, current prices, stock)
  const cart = await getCart(sessionId);
  if (cart.items.length === 0) throw new AppError("Your cart is empty", 400);

  // Anything changed since the customer last looked? They review it first (design 3.3).
  const changes = cart.notices.filter((n) => n.type !== "out_of_stock");
  if (changes.length > 0) {
    throw new AppError(
      "Your cart has changed. Please review it before placing your order.",
      409,
      changes.map((n) => ({ field: "cart", message: n.message })),
    );
  }
  if (!cart.canCheckout) {
    throw new AppError(
      "Some items in your cart are out of stock. Remove them to continue.",
      400,
    );
  }

  // 2. City and delivery charge (the same rules as the cart preview)
  const city = await resolveCity(input.address);
  const delivery = await calculateDelivery(
    city,
    cart.weightGrams,
    cart.subtotal,
  );
  if (!delivery.available) {
    const contact = delivery.support
      ? [{ field: "support", message: `WhatsApp ${delivery.support.whatsapp}` }]
      : undefined;
    throw new AppError(delivery.message, 400, contact);
  }

  const settings = await getSettings();
  const orderId = new mongoose.Types.ObjectId();
  let order: OrderDocument | undefined;

  // 3. One transaction: reserve stock, customer, city, order number, order, cart.
  //    Any error = NOTHING is saved (no stock held, no number used, cart unchanged).
  try {
    await mongoose.connection.transaction(async (session) => {
      const items: OrderItem[] = [];

      for (const line of cart.items) {
        const variant = await reserveStock(
          line.variantId,
          line.quantity,
          orderId,
          session,
        );
        // The price could have changed in the seconds since the cart was checked
        if (variant.price !== line.price) {
          throw new AppError(
            "A price in your cart has just changed. Please review your cart.",
            409,
          );
        }
        items.push({
          product: variant.product,
          variant: variant._id,
          name: line.productName,
          variantLabel: line.label,
          sku: line.sku,
          unitPrice: variant.price,
          unitCost: variant.costPrice,
          qty: line.quantity,
          discount: 0,
          lineTotal: variant.price * line.quantity,
          batchAllocations: [],
        });
      }

      // One customer per phone: found, or created. The latest name and email are kept.
      const customer = await Customer.findOneAndUpdate(
        { phone: input.phone },
        {
          $set: {
            name: input.name,
            ...(input.email ? { email: input.email } : {}),
            "stats.lastOrderAt": new Date(),
          },
          $inc: { "stats.orderCount": 1 },
        },
        { upsert: true, returnDocument: "after", session },
      );
      if (!customer) throw new Error("Customer could not be saved");

      // Orders per phone per day (BR-16). After the customer write, so simultaneous orders collide and retry.
      await assertDailyLimit(input.phone, session);
      // A typed city is added to the list (source "customer") so the admin can review it
      let cityRef = city.id ?? undefined;
      if (!city.listed) {
        const saved = await City.findOneAndUpdate(
          { name: city.name, province: city.province },
          {
            $setOnInsert: {
              name: city.name,
              province: city.province,
              source: "customer",
              isBlocked: false,
              sortOrder: 100,
            },
          },
          {
            upsert: true,
            returnDocument: "after",
            collation: CITY_COLLATION,
            session,
          },
        );
        cityRef = saved?.id;
      }

      const orderNumber = await nextOrderNumber(settings.orderPrefix, session);
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

      const [created] = await Order.create(
        [
          {
            _id: orderId,
            orderNumber,
            customer: customer._id,
            customerSnapshot: {
              name: input.name,
              phone: input.phone,
              email: input.email,
              address: {
                line1: input.address.line1,
                line2: input.address.line2,
                area: input.address.area,
                city: city.name,
                cityRef,
                cityUnlisted: !city.listed,
                province: city.province,
              },
            },
            items,
            pricing: {
              subtotal,
              discountTotal: 0,
              deliveryCharge: delivery.charge,
              total: subtotal + delivery.charge,
            },
            deliveryZone: {
              zone: delivery.zoneId,
              name: delivery.zone,
              estimateText: delivery.estimateText,
            },
            payment,
            status: "new",
            statusHistory: [
              { status: "new", at: new Date(), note: "Placed by customer" },
            ],
            flags: { stockShortfall: false, unlistedCity: !city.listed },
            source: { sessionId, ...input.source },
          },
        ],
        { session },
      );

      // The cart becomes this order. If it is no longer active, the order was already placed
      // (a double click on "Place order"): stop, and the whole transaction is undone.
      const converted = await Cart.updateOne(
        { sessionId, status: "active" },
        {
          $set: {
            status: "converted",
            convertedOrder: orderId,
            lastActivityAt: new Date(),
          },
        },
        { session },
      );
      if (converted.modifiedCount !== 1) {
        throw new AppError(
          "This order has already been placed. Please check your order confirmation.",
          409,
        );
      }

      order = created;
    });
  } catch (error) {
    if (error instanceof StockShortError) {
      const line = cart.items.find((l) => l.variantId === error.variantId);
      const name = line ? `${line.productName} (${line.label})` : "An item";
      throw new AppError(
        error.available > 0
          ? `Sorry, only ${error.available} of ${name} left. Please update your cart.`
          : `Sorry, ${name} has just sold out. Please update your cart.`,
        409,
      );
    }
    throw error;
  }

  if (!order) throw new Error("Order was not created");

  // After the order is safely saved: the order-placed email (if the customer gave an email).
  // The order_completed analytics event comes in a later phase.
  notifyOrder(order._id, "orderPlaced");
  return toConfirmation(order);
}

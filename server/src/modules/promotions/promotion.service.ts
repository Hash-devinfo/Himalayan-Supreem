import mongoose, { isValidObjectId } from 'mongoose';
import Category from '../../models/Category.js';
import Product from '../../models/Product.js';
import Promotion, { type PromotionDocument } from '../../models/Promotion.js';
import PromotionRedemption from '../../models/PromotionRedemption.js';
import AppError from '../../utils/AppError.js';
import { addDays, formatPktDate, startOfTodayPkt } from '../../utils/dates.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import { checkRules, type CreatePromotionInput, type ListPromotionsQuery, type UpdatePromotionInput } from './promotion.validation.js';
import type { PromotionRule } from './discount.engine.js';

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Is it running right now? ──────────────────────────

export function isLive(promo: { status: string; startsAt: Date; endsAt?: Date | null }, now: Date = new Date()): boolean {
  return promo.status === 'active' && promo.startsAt <= now && (!promo.endsAt || now < promo.endsAt);
}

function stateText(promo: PromotionDocument, now: Date): string {
  if (promo.status === 'ended') return 'Ended';
  if (promo.status === 'paused') return 'Paused';
  if (promo.startsAt > now) return `Starts ${formatPktDate(promo.startsAt)}`;
  if (promo.endsAt && now >= promo.endsAt) return 'Finished (end date passed)';
  if (promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit) return 'Used up';
  return 'Running';
}

export function toPromotionView(promo: PromotionDocument, now: Date = new Date()) {
  return {
    id: promo.id as string,
    name: promo.name,
    type: promo.type,
    code: promo.code,
    discountType: promo.discountType,
    value: promo.value,
    maxDiscount: promo.maxDiscount,
    products: promo.appliesTo.products.map(String),
    categories: promo.appliesTo.categories.map(String),
    wholeStore: promo.appliesTo.products.length === 0 && promo.appliesTo.categories.length === 0,
    minOrderTotal: promo.minOrderTotal,
    startsOn: formatPktDate(promo.startsAt),
    endsOn: promo.endsAt ? formatPktDate(addDays(promo.endsAt, -1)) : null, // the last day
    usageLimit: promo.usageLimit,
    perCustomerLimit: promo.perCustomerLimit,
    usageCount: promo.usageCount,
    status: promo.status,
    live: isLive(promo, now) && !(promo.usageLimit !== undefined && promo.usageCount >= promo.usageLimit),
    state: stateText(promo, now),
  };
}

// For the discount engine
export function toRule(promo: PromotionDocument): PromotionRule {
  return {
    id: promo.id as string,
    name: promo.name,
    discountType: promo.discountType,
    value: promo.value,
    products: promo.appliesTo.products.map(String),
    categories: promo.appliesTo.categories.map(String),
    maxDiscount: promo.maxDiscount ?? undefined,
    minOrderTotal: promo.minOrderTotal ?? undefined,
  };
}

// ── Checks ────────────────────────────────────────────

async function assertTargetsExist(products: string[], categories: string[]) {
  if (products.length) {
    const found = await Product.countDocuments({ _id: mongoose.trusted({ $in: products }), status: mongoose.trusted({ $ne: 'archived' }) });
    if (found !== new Set(products).size) throw new AppError('One of the chosen products was not found or is archived', 400);
  }
  if (categories.length) {
    const found = await Category.countDocuments({ _id: mongoose.trusted({ $in: categories }) });
    if (found !== new Set(categories).size) throw new AppError('One of the chosen categories was not found', 400);
  }
}

async function assertCodeFree(code: string | undefined, exceptId?: string) {
  if (!code) return;
  const filter: Record<string, unknown> = { code };
  if (exceptId) filter._id = mongoose.trusted({ $ne: exceptId });
  const other = await Promotion.findOne(filter).select('name');
  if (other) throw new AppError(`The code ${code} is already used by "${other.name}"`, 409);
}

// The same rules as the create form, run on the promotion as it will be after an edit
function assertRules(fields: Parameters<typeof checkRules>[0]) {
  const problems: { field: string; message: string }[] = [];
  checkRules(fields, { addIssue: (i: { path?: PropertyKey[]; message?: string }) => problems.push({ field: String(i.path?.[0] ?? 'body'), message: i.message ?? '' }) } as never);
  if (problems.length) throw new AppError('Please check the promotion', 400, problems);
}

async function findPromotion(id: string, session?: mongoose.ClientSession): Promise<PromotionDocument> {
  if (!isValidObjectId(id)) throw new AppError('Promotion not found', 404);
  const promo = await Promotion.findById(id).session(session ?? null);
  if (!promo) throw new AppError('Promotion not found', 404);
  return promo;
}

// ── Create ────────────────────────────────────────────

export async function createPromotion(input: CreatePromotionInput, actor: ActorContext) {
  await assertTargetsExist(input.products, input.categories);
  await assertCodeFree(input.code);

  return mongoose.connection.transaction(async (session) => {
    const [promo] = await Promotion.create(
      [
        {
          name: input.name,
          type: input.type,
          code: input.code,
          audience: input.audience,
          discountType: input.discountType,
          value: input.value,
          maxDiscount: input.maxDiscount,
          appliesTo: { products: input.products, categories: input.categories },
          minOrderTotal: input.minOrderTotal,
          startsAt: input.startsOn ?? startOfTodayPkt(),
          endsAt: input.endsOn ? addDays(input.endsOn, 1) : undefined, // runs to the end of the last day
          usageLimit: input.usageLimit,
          perCustomerLimit: input.perCustomerLimit,
          status: input.status,
          createdBy: actor.adminId,
        },
      ],
      { session }
    );
    const view = toPromotionView(promo!);
    await recordAudit(
      { admin: actor.adminId, action: 'promotion.create', entityType: 'Promotion', entityId: promo!.id, after: view, ip: actor.ip },
      session
    );
    return view;
  });
}

// ── Edit ──────────────────────────────────────────────

export async function updatePromotion(id: string, input: UpdatePromotionInput, actor: ActorContext) {
  const current = await findPromotion(id);
  if (current.status === 'ended') throw new AppError('An ended promotion cannot be changed. Create a new one.', 409);
  if (input.code !== undefined && input.code !== current.code && current.usageCount > 0) {
    throw new AppError('The code cannot be changed after customers have used it. Create a new promotion instead.', 409);
  }

  const before = toPromotionView(current);
  const products = input.products ?? before.products;
  const categories = input.categories ?? before.categories;
  const pick = <T>(value: T | null | undefined, old: T | undefined) => (value === null ? undefined : (value ?? old));

  const merged = {
    type: current.type,
    code: input.code ?? current.code,
    audience: current.audience,
    discountType: input.discountType ?? current.discountType,
    value: input.value ?? current.value,
    maxDiscount: pick(input.maxDiscount, current.maxDiscount),
    products,
    categories,
    minOrderTotal: pick(input.minOrderTotal, current.minOrderTotal),
    startsOn: input.startsOn ?? current.startsAt,
    endsOn: input.endsOn === null ? undefined : (input.endsOn ?? (current.endsAt ? addDays(current.endsAt, -1) : undefined)),
    usageLimit: pick(input.usageLimit, current.usageLimit),
    perCustomerLimit: pick(input.perCustomerLimit, current.perCustomerLimit),
  };
  assertRules(merged);
  if (merged.usageLimit !== undefined && merged.usageLimit < current.usageCount) {
    throw new AppError(`The usage limit cannot be lower than the ${current.usageCount} uses so far`, 400);
  }
  await assertTargetsExist(input.products ?? [], input.categories ?? []);
  await assertCodeFree(input.code, id);

  return mongoose.connection.transaction(async (session) => {
    const promo = await findPromotion(id, session);
    promo.name = input.name ?? promo.name;
    promo.code = merged.code;
    promo.discountType = merged.discountType;
    promo.value = merged.value;
    promo.maxDiscount = merged.maxDiscount;
    promo.set('appliesTo', { products, categories });
    promo.minOrderTotal = merged.minOrderTotal;
    promo.startsAt = merged.startsOn;
    promo.endsAt = merged.endsOn ? addDays(merged.endsOn, 1) : undefined;
    promo.usageLimit = merged.usageLimit;
    promo.perCustomerLimit = merged.perCustomerLimit;
    await promo.save({ session });

    const after = toPromotionView(promo);
    await recordAudit(
      { admin: actor.adminId, action: 'promotion.update', entityType: 'Promotion', entityId: promo.id, before, after, ip: actor.ip },
      session
    );
    return after;
  });
}

// ── Pause, resume, end ────────────────────────────────

const MOVES = {
  pause: { from: ['active'], to: 'paused' },
  resume: { from: ['paused'], to: 'active' },
  end: { from: ['active', 'paused'], to: 'ended' }, // final
} as const;

export async function changePromotionStatus(id: string, move: keyof typeof MOVES, actor: ActorContext) {
  return mongoose.connection.transaction(async (session) => {
    const promo = await findPromotion(id, session);
    const rule = MOVES[move];
    if (!(rule.from as readonly string[]).includes(promo.status)) {
      throw new AppError(`A promotion that is "${promo.status}" cannot be ${move === 'end' ? 'ended' : move + 'd'}`, 409);
    }
    const before = promo.status;
    promo.status = rule.to;
    await promo.save({ session });
    await recordAudit(
      { admin: actor.adminId, action: `promotion.${move}`, entityType: 'Promotion', entityId: promo.id, before: { status: before }, after: { status: promo.status }, ip: actor.ip },
      session
    );
    return toPromotionView(promo);
  });
}

// ── List and details ──────────────────────────────────

export async function listPromotions(query: ListPromotionsQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = mongoose.trusted([{ name: pattern }, { code: pattern }]);
  }
  const [promos, total] = await Promise.all([
    Promotion.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Promotion.countDocuments(filter),
  ]);
  const now = new Date();
  return { items: promos.map((p) => toPromotionView(p, now)), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
}

export async function getPromotion(id: string) {
  const promo = await findPromotion(id);
  const [usage] = await PromotionRedemption.aggregate<{ orders: number; discount: number }>([
    { $match: { promotion: promo._id, status: 'used' } },
    { $group: { _id: null, orders: { $sum: 1 }, discount: { $sum: '$amount' } } },
  ]);
  return { promotion: toPromotionView(promo), usage: { orders: usage?.orders ?? 0, discountGiven: usage?.discount ?? 0 } };
}
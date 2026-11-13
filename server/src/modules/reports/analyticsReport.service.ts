import AnalyticsEvent from '../../models/AnalyticsEvent.js';
import Cart from '../../models/Cart.js';
import Product from '../../models/Product.js';
import Variant from '../../models/Variant.js';
import mongoose from 'mongoose';
import { resolveRange } from './reportRange.js';
import type { AnalyticsQuery } from './report.validation.js';

export const ANALYTICS_DEFINITIONS = {
  visitors: 'Different browsers (anonymous visitor IDs) with at least one event in the period. Not people: one person on two phones counts twice.',
  funnel: 'Of the visitors in the period: how many viewed a product, added to cart, started checkout, and completed an order.',
  conversion: 'Each step as a percentage of the visitors who viewed a product.',
  topSearches: 'What customers typed in the search box (long numbers masked). Searches with 0 results show what customers want that the store does not list.',
  trafficSources: 'Where visitors first came from in the period: the campaign (utm_source) if the link had one, otherwise the referring website, otherwise "direct".',
  abandonedCarts: 'Carts with items that were left without ordering, by last activity date. Customers are never contacted about them (requirements 3.2).',
  bots: 'Search engines and link previews are not counted.',
};

const FUNNEL_STEPS = [
  { type: 'product_view', label: 'Viewed a product' },
  { type: 'add_to_cart', label: 'Added to cart' },
  { type: 'checkout_start', label: 'Started checkout' },
  { type: 'order_completed', label: 'Completed an order' },
] as const;

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : null);

export async function analyticsReport(query: AnalyticsQuery) {
  const range = resolveRange(query.from, query.to);
  const inRange = { createdAt: { $gte: range.start, $lt: range.end } };

  const [byType, visitorsByType, totalVisitors, views, adds, searches, firstSources, abandoned, converted] = await Promise.all([
    // Every event type: how many times
    AnalyticsEvent.aggregate<{ _id: string; events: number }>([{ $match: inRange }, { $group: { _id: '$type', events: { $sum: 1 } } }]),

    // Every event type: how many different visitors (for the funnel)
    AnalyticsEvent.aggregate<{ _id: string; visitors: number }>([
      { $match: { ...inRange, visitorId: { $ne: null } } },
      { $group: { _id: { type: '$type', visitor: '$visitorId' } } },
      { $group: { _id: '$_id.type', visitors: { $sum: 1 } } },
    ]),

    AnalyticsEvent.aggregate<{ visitors: number }>([
      { $match: { ...inRange, visitorId: { $ne: null } } },
      { $group: { _id: '$visitorId' } },
      { $count: 'visitors' },
    ]),

    AnalyticsEvent.aggregate<{ _id: mongoose.Types.ObjectId; views: number; visitors: number }>([
      { $match: { ...inRange, type: 'product_view' } },
      { $group: { _id: '$product', views: { $sum: 1 }, visitorSet: { $addToSet: '$visitorId' } } },
      { $project: { views: 1, visitors: { $size: '$visitorSet' } } },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]),

    AnalyticsEvent.aggregate<{ _id: mongoose.Types.ObjectId; adds: number }>([
      { $match: { ...inRange, type: 'add_to_cart' } },
      { $group: { _id: '$variant', adds: { $sum: 1 } } },
      { $sort: { adds: -1 } },
      { $limit: 20 },
    ]),

    AnalyticsEvent.aggregate<{ _id: string; searches: number; zeroResults: number; avgResults: number }>([
      { $match: { ...inRange, type: 'search', searchQuery: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$searchQuery',
          searches: { $sum: 1 },
          zeroResults: { $sum: { $cond: [{ $eq: ['$resultCount', 0] }, 1, 0] } },
          avgResults: { $avg: '$resultCount' },
        },
      },
      { $sort: { searches: -1 } },
      { $limit: 50 },
    ]),

    // Each visitor's FIRST page view in the period, and where it came from
    AnalyticsEvent.aggregate<{ _id: string; source: string }>([
      { $match: { ...inRange, type: 'page_view', visitorId: { $ne: null } } },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: '$visitorId',
          source: { $first: { $ifNull: ['$source.utmSource', { $ifNull: ['$source.referrer', 'direct'] }] } },
        },
      },
    ]),

    Cart.aggregate<{ carts: number; units: number; value: number }>([
      { $match: { status: 'abandoned', lastActivityAt: { $gte: range.start, $lt: range.end } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$_id',
          units: { $sum: '$items.quantity' },
          value: { $sum: { $multiply: ['$items.quantity', '$items.lastSeenPrice'] } },
        },
      },
      { $group: { _id: null, carts: { $sum: 1 }, units: { $sum: '$units' }, value: { $sum: '$value' } } },
    ]),

    Cart.countDocuments({ status: 'converted', lastActivityAt: mongoose.trusted({ $gte: range.start, $lt: range.end }) } as Record<string, unknown>),
  ]);

  // Names for the product and size lists
  const [products, variants] = await Promise.all([
    Product.find({ _id: mongoose.trusted({ $in: views.map((v) => v._id) }) } as Record<string, unknown>).select('name').lean(),
    Variant.find({ _id: mongoose.trusted({ $in: adds.map((a) => a._id) }) } as Record<string, unknown>)
      .select('sku label product')
      .populate<{ product: { name: string } | null }>('product', 'name')
      .lean(),
  ]);

  // Traffic sources, and how many of those visitors went on to order
  // distinct() is a query, so (unlike aggregate) our own $-operators must be marked trusted
  const orderedFilter: Record<string, unknown> = { type: 'order_completed', createdAt: mongoose.trusted({ $gte: range.start, $lt: range.end }) };
  const ordered = new Set((await AnalyticsEvent.distinct('visitorId', orderedFilter)).filter(Boolean).map(String));
  const sources = new Map<string, { visitors: number; ordered: number }>();
  for (const v of firstSources) {
    const row = sources.get(v.source) ?? { visitors: 0, ordered: 0 };
    row.visitors += 1;
    if (ordered.has(v._id)) row.ordered += 1;
    sources.set(v.source, row);
  }

  const eventsOf = (type: string) => byType.find((t) => t._id === type)?.events ?? 0;
  const visitorsOf = (type: string) => visitorsByType.find((t) => t._id === type)?.visitors ?? 0;
  const viewers = visitorsOf('product_view');
  const abandonedRow = abandoned[0] ?? { carts: 0, units: 0, value: 0 };

  return {
    range: { from: range.from, to: range.to },
    summary: {
      visitors: totalVisitors[0]?.visitors ?? 0,
      pageViews: eventsOf('page_view'),
      productViews: eventsOf('product_view'),
      searches: eventsOf('search'),
      addToCarts: eventsOf('add_to_cart'),
      checkoutStarts: eventsOf('checkout_start'),
      ordersCompleted: eventsOf('order_completed'),
      abandonedCarts: abandonedRow.carts,
      abandonedCartValue: abandonedRow.value,
      cartsConverted: converted,
    },
    funnel: FUNNEL_STEPS.map((step) => ({
      step: step.label,
      visitors: visitorsOf(step.type),
      percentOfViewers: pct(visitorsOf(step.type), viewers),
    })),
    topProducts: views.map((v) => ({
      product: products.find((p) => String(p._id) === String(v._id))?.name ?? '(removed product)',
      views: v.views,
      visitors: v.visitors,
    })),
    topAddedToCart: adds.map((a) => {
      const variant = variants.find((x) => String(x._id) === String(a._id));
      return { product: variant ? `${variant.product?.name ?? '(removed)'} (${variant.label})` : '(removed size)', sku: variant?.sku ?? null, adds: a.adds };
    }),
    topSearches: searches.map((s) => ({ search: s._id, searches: s.searches, zeroResults: s.zeroResults, avgResults: Math.round(s.avgResults * 10) / 10 })),
    zeroResultSearches: searches.filter((s) => s.zeroResults > 0).map((s) => ({ search: s._id, times: s.zeroResults })),
    trafficSources: [...sources.entries()]
      .map(([source, r]) => ({ source, visitors: r.visitors, ordered: r.ordered, orderPercent: pct(r.ordered, r.visitors) }))
      .sort((a, b) => b.visitors - a.visitors),
    definitions: ANALYTICS_DEFINITIONS,
  };
}
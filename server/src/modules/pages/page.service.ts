import mongoose from 'mongoose';
import Page from '../../models/Page.js';
import { PAGE_SLUGS, type PageSlug } from '../../constants/enums.js';
import AppError from '../../utils/AppError.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { UpdatePageInput } from './page.validation.js';

const PLACEHOLDER_TEXT =
  'PLACEHOLDER: this page has not been written yet. The business must write it and have it reviewed before launch.';

// Default titles, and what each page must cover (from requirements section 8).
// These are NOTES for the business, never shown to customers as policy wording.
export const PAGE_INFO: Record<PageSlug, { title: string; mustCover: string[] }> = {
  refund: {
    title: 'Refund and returns policy',
    mustCover: [
      'Refunds only for damaged or incorrect products; no change-of-mind refunds',
      'Opened products are not returnable unless damaged or incorrect',
      'How soon damage or a wrong item must be reported, and how to contact the store',
      'What evidence is needed (for example photos)',
      'Refund only, or replacement as well',
      'How COD refunds are paid (for example bank transfer or mobile wallet) and how long it takes',
    ],
  },
  privacy: {
    title: 'Privacy notice',
    mustCover: [
      'What is collected at guest checkout (name, phone, email if given, address)',
      'That the checkout phone number is used for WhatsApp order updates',
      'Email notifications, saved carts, analytics and reviews',
      'Who the data is shared with (couriers) and how long it is kept',
      'How a customer can ask for their data to be corrected or removed',
    ],
  },
  delivery: {
    title: 'Delivery information',
    mustCover: [
      'Delivery across Pakistan, subject to courier coverage at the address',
      'Delivery estimates are indicative and depend on the courier',
      'Delivery charges and the free-delivery threshold',
      'Cash on delivery; what happens if a parcel is refused',
      'Cancelling before the order is packed',
    ],
  },
  terms: {
    title: 'Terms of service',
    mustCover: ['Ordering, pricing and stock', 'Product information and disclaimers suitable for the products sold', 'Contact details'],
  },
  'review-rules': {
    title: 'Review rules',
    mustCover: ['Only customers with a delivered order can review', 'What content is removed and how reviews are moderated'],
  },
};

// Creates any missing page as a clearly marked placeholder (never overwrites written pages)
export async function ensurePages(): Promise<void> {
  await Page.bulkWrite(
    PAGE_SLUGS.map((slug) => ({
      updateOne: {
        filter: { slug },
        update: { $setOnInsert: { slug, title: PAGE_INFO[slug].title, content: PLACEHOLDER_TEXT, status: 'placeholder' } },
        upsert: true,
      },
    }))
  );
}

// ── Admin ─────────────────────────────────────────────

export async function listPages() {
  await ensurePages();
  const pages = await Page.find().select('slug title status updatedAt approvedAt').lean();
  const bySlug = new Map(pages.map((p) => [p.slug, p]));
  const list = PAGE_SLUGS.map((slug) => {
    const p = bySlug.get(slug)!;
    return { slug, title: p.title, status: p.status, updatedAt: p.updatedAt, approvedAt: p.approvedAt ?? null, mustCover: PAGE_INFO[slug].mustCover };
  });
  return { pages: list, allApproved: list.every((p) => p.status === 'approved') };
}

export async function getPageForAdmin(slug: PageSlug) {
  await ensurePages();
  const page = await Page.findOne({ slug }).populate('updatedBy approvedBy', 'name').lean();
  return { page, mustCover: PAGE_INFO[slug].mustCover };
}

// Any edit needs a new review: an approved page goes back to "needs review"
export async function updatePage(slug: PageSlug, input: UpdatePageInput, actor: ActorContext) {
  await ensurePages();
  const before = await Page.findOne({ slug }).lean();
  if (!before) throw new AppError('Page not found', 404);

  const set: Record<string, unknown> = { status: 'needs_review', updatedBy: new mongoose.Types.ObjectId(actor.adminId) };
  if (input.title !== undefined) set.title = input.title;
  if (input.content !== undefined) set.content = input.content;

  const page = await Page.findOneAndUpdate({ slug }, { $set: set, $unset: { approvedAt: 1, approvedBy: 1 } }, { returnDocument: 'after' }).lean();

  await recordAudit({
    admin: actor.adminId,
    action: 'page.update',
    entityType: 'Page',
    entityId: String(before._id),
    // The full text is kept on the page itself; the log records what changed
    before: { status: before.status, title: before.title, contentLength: before.content.length },
    after: { status: 'needs_review', title: page!.title, contentLength: page!.content.length },
    ip: actor.ip,
  });
  return { page };
}

// The business confirms the wording is final. Placeholders cannot be approved.
export async function approvePage(slug: PageSlug, actor: ActorContext) {
  await ensurePages();
  const page = await Page.findOneAndUpdate(
    { slug, status: 'needs_review' }, // only a written, unapproved page; also stops double approvals
    { $set: { status: 'approved', approvedAt: new Date(), approvedBy: new mongoose.Types.ObjectId(actor.adminId) } },
    { returnDocument: 'after' }
  ).lean();

  if (!page) {
    const current = await Page.findOne({ slug }).select('status').lean();
    throw new AppError(
      current?.status === 'approved' ? 'This page is already approved' : 'Write the page content first; a placeholder cannot be approved',
      409
    );
  }

  await recordAudit({
    admin: actor.adminId,
    action: 'page.approve',
    entityType: 'Page',
    entityId: String(page._id),
    before: { status: 'needs_review' },
    after: { status: 'approved' },
    ip: actor.ip,
  });
  return { page };
}

// ── Public (storefront) ───────────────────────────────

// For footer links and the checkout "store policies" links
export async function listPublicPages() {
  await ensurePages();
  const pages = await Page.find().select('slug title status').lean();
  return { pages: PAGE_SLUGS.map((slug) => pages.find((p) => p.slug === slug)!).map((p) => ({ slug: p.slug, title: p.title, reviewPending: p.status !== 'approved' })) };
}

export async function getPublicPage(slug: PageSlug) {
  await ensurePages();
  const page = await Page.findOne({ slug }).select('slug title content status updatedAt').lean();
  if (!page) throw new AppError('Page not found', 404);
  return {
    page: {
      slug: page.slug,
      title: page.title,
      content: page.content,
      // The storefront shows a "draft, pending business review" notice until approved
      reviewPending: page.status !== 'approved',
      updatedAt: page.updatedAt,
    },
  };
}
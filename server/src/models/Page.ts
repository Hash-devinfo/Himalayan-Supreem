import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { PAGE_SLUGS, PAGE_STATUSES, type PageSlug, type PageStatus } from '../constants/enums.js';

// Store policy pages (requirements section 8). The business writes the words; the system never
// invents legal wording. Every edit sends the page back to "needs review" until approved again.
export interface IPage {
  slug: PageSlug;
  title: string;
  content: string; // plain text (simple Markdown allowed); never raw HTML
  status: PageStatus;
  updatedBy?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type PageDocument = HydratedDocument<IPage>;

const pageSchema = new Schema<IPage>(
  {
    slug: { type: String, enum: PAGE_SLUGS, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, maxlength: 50_000 },
    status: { type: String, enum: PAGE_STATUSES, required: true, default: 'placeholder' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },
  },
  { timestamps: true, toJSON: { versionKey: false } }
);

const Page = model<IPage>('Page', pageSchema);

export default Page;
import { Schema, model, type HydratedDocument } from 'mongoose';

// One document holds all store-wide settings. Its _id is always "store".
export const SETTINGS_ID = 'store';

export interface StoreInfo {
  name: string;
  email?: string;
  whatsappNumber?: string; // stored as +923XXXXXXXXX
  supportHours?: string;
}

export interface ISetting {
  _id: string;
  store: StoreInfo;
  orderPrefix: string;
  freeDeliveryThreshold?: number; // PKR; empty = no free delivery
  defaultPackagingCost?: number; // PKR, for profit reports
  createdAt: Date;
  updatedAt: Date;
}

export type SettingDocument = HydratedDocument<ISetting>;

const wholeNumber = {
  validator: Number.isInteger,
  message: '{PATH} must be a whole number',
};

const storeInfoSchema = new Schema<StoreInfo>(
  {
    // PLACEHOLDER until the business provides the real name
    name: { type: String, required: true, trim: true, maxlength: 80, default: '[Store name — placeholder]' },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    whatsappNumber: { type: String, trim: true, match: [/^\+923\d{9}$/, 'WhatsApp number must be stored as +923XXXXXXXXX'] },
    supportHours: { type: String, trim: true, maxlength: 120 },
  },
  { _id: false }
);

const settingSchema = new Schema<ISetting>(
  {
    _id: { type: String, default: SETTINGS_ID },
    store: { type: storeInfoSchema, default: () => ({}) },
    orderPrefix: {
      type: String,
      default: 'ORD',
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,6}$/, 'Order prefix must be 2 to 6 letters'],
    },
    freeDeliveryThreshold: { type: Number, min: 0, validate: wholeNumber },
    defaultPackagingCost: { type: Number, min: 0, validate: wholeNumber },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

const Setting = model<ISetting>('Setting', settingSchema);

export default Setting;
import { Schema, model, type HydratedDocument } from 'mongoose';
import { NOTIFICATION_TEMPLATES, type NotificationTemplate } from '../constants/enums.js';
import { DEFAULT_INVENTORY_RULES } from '../constants/inventory.js';

// One document holds all store-wide settings. Its _id is always "store".
export const SETTINGS_ID = 'store';

export interface StoreInfo {
  name: string;
  email?: string;
  whatsappNumber?: string; // stored as +923XXXXXXXXX
  supportHours?: string;
}

// The business writes these words (design 3.8). Empty = that message is not sent.
export interface MessageTemplate {
  emailSubject?: string;
  emailBody?: string;
  whatsappBody?: string;
}

export type MessageTemplates = Record<NotificationTemplate, MessageTemplate>;

// Inventory rules the admin can change (defaults in constants/inventory.ts)
export interface InventorySettings {
  sellByCutoffDays: number;
  expiryWarningDays: number;
  defaultLowStockThreshold: number;
}

export interface ISetting {
  _id: string;
  store: StoreInfo;
  orderPrefix: string;
  freeDeliveryThreshold?: number; // PKR; empty = no free delivery
  defaultPackagingCost?: number; // PKR, for profit reports
  inventory: InventorySettings;
  templates: MessageTemplates;
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

const messageTemplateSchema = new Schema<MessageTemplate>(
  {
    emailSubject: { type: String, trim: true, maxlength: 200 },
    emailBody: { type: String, trim: true, maxlength: 3000 },
    whatsappBody: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false }
);

const inventorySettingsSchema = new Schema<InventorySettings>(
  {
    sellByCutoffDays: { type: Number, min: 0, max: 90, validate: wholeNumber, default: DEFAULT_INVENTORY_RULES.sellByCutoffDays },
    expiryWarningDays: { type: Number, min: 1, max: 365, validate: wholeNumber, default: DEFAULT_INVENTORY_RULES.expiryWarningDays },
    defaultLowStockThreshold: { type: Number, min: 0, max: 100_000, validate: wholeNumber, default: DEFAULT_INVENTORY_RULES.defaultLowStockThreshold },
  },
  { _id: false }
);

// One empty template per message type: { orderPlaced: {}, confirmed: {}, ... }
const templatesSchema = new Schema<MessageTemplates>(
  Object.fromEntries(NOTIFICATION_TEMPLATES.map((key) => [key, { type: messageTemplateSchema, default: () => ({}) }])),
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
    inventory: { type: inventorySettingsSchema, default: () => ({}) },
    templates: { type: templatesSchema, default: () => ({}) },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

const Setting = model<ISetting>('Setting', settingSchema);

export default Setting;
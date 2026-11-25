import { Schema, model, type HydratedDocument } from "mongoose";
import {
  NOTIFICATION_TEMPLATES,
  type NotificationTemplate,
} from "../constants/enums.js";
import { DEFAULT_INVENTORY_RULES } from "../constants/inventory.js";
import { DEFAULT_RISK_RULES } from "../constants/risk.js";

// One document holds all store-wide settings. Its _id is always "store".
export const SETTINGS_ID = "store";
// PostEx booking settings (Phase 20): which registered PostEx address parcels are picked up from / returned to
export interface PostexSettings {
  pickupAddressCode?: string;
  returnAddressCode?: string;
}
export interface StoreLogo {
  url: string; // for the website header (max 600 px wide)
  thumbUrl: string; // small copy (max 200 px wide), e.g. for emails and the admin
  publicId: string;
  width?: number;
  height?: number;
}

export interface StoreInfo {
  name: string;
  logo?: StoreLogo;
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

// Fake-order protection rules (defaults in constants/risk.ts)
export interface RiskSettings {
  refusalThreshold: number;
  dailyOrderLimit: number;
}

export interface ISetting {
  _id: string;
  store: StoreInfo;
  orderPrefix: string;
  freeDeliveryThreshold?: number; // PKR; empty = no free delivery
  defaultPackagingCost?: number; // PKR, for profit reports
  inventory: InventorySettings;
  templates: MessageTemplates;
    postex?: PostexSettings;
  risk: RiskSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type SettingDocument = HydratedDocument<ISetting>;

const wholeNumber = {
  validator: Number.isInteger,
  message: "{PATH} must be a whole number",
};

const storeInfoSchema = new Schema<StoreInfo>(
  {
    // PLACEHOLDER until the business provides the real name
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      default: "Himalayan Supreme",
    },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    whatsappNumber: {
      type: String,
      trim: true,
      match: [
        /^\+923\d{9}$/,
        "WhatsApp number must be stored as +923XXXXXXXXX",
      ],
    },
    supportHours: { type: String, trim: true, maxlength: 120 },
        logo: {
      type: new Schema<StoreLogo>(
        {
          url: { type: String, required: true },
          thumbUrl: { type: String, required: true },
          publicId: { type: String, required: true },
          width: { type: Number },
          height: { type: Number },
        },
        { _id: false },
      ),
    },
  },
  { _id: false },
);

const messageTemplateSchema = new Schema<MessageTemplate>(
  {
    emailSubject: { type: String, trim: true, maxlength: 200 },
    emailBody: { type: String, trim: true, maxlength: 3000 },
    whatsappBody: { type: String, trim: true, maxlength: 1000 },
  },
  { _id: false },
);

const inventorySettingsSchema = new Schema<InventorySettings>(
  {
    sellByCutoffDays: {
      type: Number,
      min: 0,
      max: 90,
      validate: wholeNumber,
      default: DEFAULT_INVENTORY_RULES.sellByCutoffDays,
    },
    expiryWarningDays: {
      type: Number,
      min: 1,
      max: 365,
      validate: wholeNumber,
      default: DEFAULT_INVENTORY_RULES.expiryWarningDays,
    },
    defaultLowStockThreshold: {
      type: Number,
      min: 0,
      max: 100_000,
      validate: wholeNumber,
      default: DEFAULT_INVENTORY_RULES.defaultLowStockThreshold,
    },
  },
  { _id: false },
);

const riskSettingsSchema = new Schema<RiskSettings>(
  {
    refusalThreshold: {
      type: Number,
      min: 1,
      max: 100,
      validate: wholeNumber,
      default: DEFAULT_RISK_RULES.refusalThreshold,
    },
    dailyOrderLimit: {
      type: Number,
      min: 1,
      max: 100,
      validate: wholeNumber,
      default: DEFAULT_RISK_RULES.dailyOrderLimit,
    },
  },
  { _id: false },
);

// One empty template per message type: { orderPlaced: {}, confirmed: {}, ... }
const templatesSchema = new Schema<MessageTemplates>(
  Object.fromEntries(
    NOTIFICATION_TEMPLATES.map((key) => [
      key,
      { type: messageTemplateSchema, default: () => ({}) },
    ]),
  ),
  { _id: false },
);

const settingSchema = new Schema<ISetting>(
  {
    _id: { type: String, default: SETTINGS_ID },
    store: { type: storeInfoSchema, default: () => ({}) },
    orderPrefix: {
      type: String,
      default: "ORD",
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,6}$/, "Order prefix must be 2 to 6 letters"],
    },
    freeDeliveryThreshold: { type: Number, min: 0, validate: wholeNumber },
    defaultPackagingCost: { type: Number, min: 0, validate: wholeNumber },
    inventory: { type: inventorySettingsSchema, default: () => ({}) },
    risk: { type: riskSettingsSchema, default: () => ({}) },
    templates: { type: templatesSchema, default: () => ({}) },
        postex: {
      type: new Schema<PostexSettings>(
        {
          pickupAddressCode: { type: String, trim: true, maxlength: 40 },
          returnAddressCode: { type: String, trim: true, maxlength: 40 },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  },
);

const Setting = model<ISetting>("Setting", settingSchema);

export default Setting;

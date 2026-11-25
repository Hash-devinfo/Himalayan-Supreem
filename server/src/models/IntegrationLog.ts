import { Schema, model, type HydratedDocument, type Types } from "mongoose";

// Every call to an outside service such as PostEx (design 23), so failed bookings and
// syncs can be seen and retried. Short summaries only: never tokens or full customer data.
export const INTEGRATION_PROVIDERS = ["postex"] as const;
export const INTEGRATION_ACTIONS = [
  "check_connection",
  "get_cities",
  "get_addresses",
  "book_shipment",
  "find_booking",
  "cancel_shipment",
  "sync_status",
  "sync_payments",
  "airway_bill",
  "load_sheet",
  "shipper_advice",
] as const;

export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];
export type IntegrationAction = (typeof INTEGRATION_ACTIONS)[number];

export const INTEGRATION_LOG_DAYS = 180; // removed automatically after this

export interface IIntegrationLog {
  provider: IntegrationProvider;
  action: IntegrationAction;
  order?: Types.ObjectId;
  orderNumber?: string;
  status: "success" | "failed";
  httpStatus?: number;
  requestSummary?: string;
  responseSummary?: string;
  error?: string;
  attempt: number;
  durationMs: number;
  expiresAt: Date;
  createdAt: Date;
}

export type IntegrationLogDocument = HydratedDocument<IIntegrationLog>;

const integrationLogSchema = new Schema<IIntegrationLog>(
  {
    provider: { type: String, enum: INTEGRATION_PROVIDERS, required: true },
    action: { type: String, enum: INTEGRATION_ACTIONS, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order" },
    orderNumber: { type: String },
    status: { type: String, enum: ["success", "failed"], required: true },
    httpStatus: { type: Number },
    requestSummary: { type: String, maxlength: 500 },
    responseSummary: { type: String, maxlength: 500 },
    error: { type: String, maxlength: 500 },
    attempt: { type: Number, default: 1 },
    durationMs: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { versionKey: false },
  },
);

integrationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
integrationLogSchema.index({ provider: 1, createdAt: -1 });
integrationLogSchema.index({ order: 1, createdAt: -1 });

const IntegrationLog = model<IIntegrationLog>(
  "IntegrationLog",
  integrationLogSchema,
);

export default IntegrationLog;

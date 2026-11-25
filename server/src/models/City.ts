import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { CITY_SOURCES, PROVINCES, type CitySource, type Province } from '../constants/enums.js';

export interface ICity {
  name: string;
  province: Province;
  zone?: Types.ObjectId;
  isBlocked: boolean;
  source: CitySource;
    sortOrder: number;
  postex?: CityPostex;
  createdAt: Date;
 
  updatedAt: Date;
}
// How PostEx knows this city (their exact spelling is needed to book a parcel)
export interface CityPostex {
  name?: string; // PostEx's city name; empty = PostEx does not deliver here
  delivers: boolean;
  manual: boolean; // true = the admin chose the match by hand (a sync never changes it)
  checkedAt: Date;
}
export type CityDocument = HydratedDocument<ICity>;

// "Lahore" and "lahore" count as the same city
export const CITY_COLLATION = { locale: 'en', strength: 2 } as const;

const citySchema = new Schema<ICity>(
  {
    name: {
      type: String,
      required: [true, 'City name is required'],
      trim: true,
      maxlength: [60, 'City name cannot be longer than 60 characters'],
    },
    province: {
      type: String,
      enum: PROVINCES,
      required: [true, 'Province is required'],
    },
    // Empty = uses the default zone
    zone: { type: Schema.Types.ObjectId, ref: 'DeliveryZone' },
    // True only when no courier serves the city
    isBlocked: { type: Boolean, default: false },
    source: { type: String, enum: CITY_SOURCES, default: 'admin' },
    // Lower numbers are listed first (major cities)
    sortOrder: { type: Number, default: 100 },
        postex: {
      type: new Schema<CityPostex>(
        {
          name: { type: String, trim: true, maxlength: 80 },
          delivers: { type: Boolean, default: false },
          manual: { type: Boolean, default: false },
          checkedAt: { type: Date, required: true },
        },
        { _id: false }
      ),
    },
  },
  {
    timestamps: true,
    toJSON: { versionKey: false },
  }
);

citySchema.index({ name: 1, province: 1 }, { unique: true, collation: CITY_COLLATION });
citySchema.index({ zone: 1 });
citySchema.index({ sortOrder: 1, name: 1 });

const City = model<ICity>('City', citySchema);

export default City;
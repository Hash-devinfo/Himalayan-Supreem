// Adds the starting list of Pakistani cities to the database.
// Safe to run again: existing cities are left exactly as they are (zone, blocked, sort order).
// Run: npm run seed:cities
import City, { CITY_COLLATION } from '../models/City.js';
import { connectDB, disconnectDB } from '../config/db.js';
import type { Province } from '../constants/enums.js';
import { MAJOR_CITIES, PAKISTAN_CITIES } from './data/pakistanCities.js';

await connectDB();

// Object.entries forgets that the keys are provinces, so we say so with "as"
const operations = (Object.entries(PAKISTAN_CITIES) as [Province, string[]][]).flatMap(([province, names]) =>
  // new Set(...) drops a name typed twice in the same province
  [...new Set(names)].map((name) => ({
    updateOne: {
      filter: { name, province },
      // $setOnInsert: only used when the city is new. Existing cities are not touched.
      update: { $setOnInsert: { name, province, source: 'seed' as const, isBlocked: false, sortOrder: MAJOR_CITIES[name] ?? 100 } },
      upsert: true,
      collation: CITY_COLLATION,
    },
  }))
);

const result = await City.bulkWrite(operations);

for (const [province, names] of Object.entries(PAKISTAN_CITIES)) {
  console.log(`  ${province}: ${new Set(names).size}`);
}
console.log(`Cities in the list: ${operations.length}`);
console.log(`Added: ${result.upsertedCount}`);
console.log(`Already there (left unchanged): ${result.matchedCount}`);

await disconnectDB();
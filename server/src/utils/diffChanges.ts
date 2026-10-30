// Compares current values with incoming updates and returns only what actually changed.
// Used for audit records: { before: { price: 1500 }, after: { price: 1800 } }
export interface Changes {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  hasChanges: boolean;
}

export function diffChanges(current: object, updates: object): Changes {
  const currentValues = current as Record<string, unknown>;
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  for (const [key, newValue] of Object.entries(updates)) {
    if (newValue === undefined) continue;
    if (currentValues[key] !== newValue) {
      before[key] = currentValues[key] ?? null;
      after[key] = newValue;
    }
  }

  return { before, after, hasChanges: Object.keys(after).length > 0 };
}
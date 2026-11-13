// Inventory rules: these are only the STARTING values. The admin changes them in
// Settings (Setting.inventory); the running values come from modules/settings/inventoryRules.ts.
export const DEFAULT_INVENTORY_RULES = {
  sellByCutoffDays: 7, // batches stop selling this many days before expiry (requirements 4.2)
  expiryWarningDays: 60, // warn about batches expiring within this many days
  defaultLowStockThreshold: 5, // for sizes without their own threshold (requirements 4.2, v1.7)
} as const;
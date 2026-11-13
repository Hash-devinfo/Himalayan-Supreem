import Setting, { SETTINGS_ID } from '../../models/Setting.js';
import { DEFAULT_INVENTORY_RULES } from '../../constants/inventory.js';

export interface InventoryRules {
  sellByCutoffDays: number;
  expiryWarningDays: number;
  defaultLowStockThreshold: number;
}

// The rules are needed in many places, often in code that is not async (e.g. "is this batch
// still sellable?"). So they are kept in memory: loaded from Settings when the server starts,
// and replaced whenever the admin saves new values.
let current: InventoryRules = { ...DEFAULT_INVENTORY_RULES };

export function inventoryRules(): InventoryRules {
  return current;
}

export function setInventoryRules(rules: Partial<InventoryRules> | undefined): void {
  current = { ...DEFAULT_INVENTORY_RULES, ...stripUndefined(rules ?? {}) };
}

// Called once at startup, after the database connects
export async function loadInventoryRules(): Promise<InventoryRules> {
  const settings = await Setting.findById(SETTINGS_ID).select('inventory').lean();
  setInventoryRules(settings?.inventory);
  return current;
}

function stripUndefined(rules: Partial<InventoryRules>): Partial<InventoryRules> {
  return Object.fromEntries(Object.entries(rules).filter(([, v]) => v !== undefined && v !== null));
}
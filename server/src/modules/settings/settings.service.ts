import Setting, { SETTINGS_ID, type SettingDocument } from '../../models/Setting.js';
import { recordAudit, type ActorContext } from '../audit/audit.service.js';
import type { UpdateSettingsInput } from './settings.validation.js';
import AppError from '../../utils/AppError.js';
import { setInventoryRules } from './inventoryRules.js';
import { runDailyInventoryCheckOnce } from '../../jobs/scheduler.js';

// Reads the settings, creating them with defaults the first time.
export async function getSettings(): Promise<SettingDocument> {
  const settings = await Setting.findOneAndUpdate(
    { _id: SETTINGS_ID },
    { $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return settings;
}

export async function updateSettings(input: UpdateSettingsInput, actor: ActorContext): Promise<SettingDocument> {
  const settings = await getSettings();

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};

  // Store details: compare field by field (store.name, store.email, ...)
  if (input.store) {
    for (const [key, value] of Object.entries(input.store)) {
      if (value === undefined) continue;
      const current = settings.store[key as keyof typeof settings.store];
      if (current !== value) {
        before[`store.${key}`] = current ?? null;
        after[`store.${key}`] = value;
        settings.set(`store.${key}`, value);
      }
    }
  }

  for (const key of ['orderPrefix', 'freeDeliveryThreshold', 'defaultPackagingCost'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    const current = settings[key];
    // null means "turn off": remove the value
    if (value === null) {
      if (current !== undefined) {
        before[key] = current;
        after[key] = null;
        settings.set(key, undefined);
      }
    } else if (current !== value) {
      before[key] = current ?? null;
      after[key] = value;
      settings.set(key, value);
    }
  }

  // Inventory rules: compare field by field (inventory.sellByCutoffDays, ...)
  if (input.inventory) {
    for (const [key, value] of Object.entries(input.inventory)) {
      if (value === undefined) continue;
      const current = settings.inventory[key as keyof typeof settings.inventory];
      if (current !== value) {
        before[`inventory.${key}`] = current;
        after[`inventory.${key}`] = value;
        settings.set(`inventory.${key}`, value);
      }
    }
    // The warning must come before stock stops selling, or it would warn too late
    if (settings.inventory.expiryWarningDays <= settings.inventory.sellByCutoffDays) {
      throw new AppError(
        `Expiry warning days (${settings.inventory.expiryWarningDays}) must be more than the stop-selling days (${settings.inventory.sellByCutoffDays})`,
        400
      );
    }
  }
  // Fake-order protection rules: compare field by field (risk.refusalThreshold, ...)
  if (input.risk) {
    for (const [key, value] of Object.entries(input.risk)) {
      if (value === undefined) continue;
      const current = settings.risk[key as keyof typeof settings.risk];
      if (current !== value) {
        before[`risk.${key}`] = current;
        after[`risk.${key}`] = value;
        settings.set(`risk.${key}`, value);
      }
    }
  }
  if (Object.keys(after).length === 0) {
    return settings;
  }

  await settings.save();
  setInventoryRules(settings.toObject().inventory); // plain values; the new rules apply from this moment

  // A new stop-selling rule changes which batches can be sold: recalculate every size's stock now
  if ('inventory.sellByCutoffDays' in after) {
    runDailyInventoryCheckOnce('settings change').catch((error: unknown) => {
      console.error('[settings] Stock recalculation after a rule change failed:', error);
    });
  }

  await recordAudit({
    admin: actor.adminId,
    action: 'settings.update',
    entityType: 'Setting',
    before,
    after,
    ip: actor.ip,
  });

  return settings;
}
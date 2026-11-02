import cron, { type ScheduledTask } from 'node-cron';
import { PKT_TIME_ZONE } from '../utils/dates.js';
import { runDailyInventoryCheck, type DailyInventorySummary } from './dailyInventory.job.js';

// Shared by the schedule and the "run now" admin route, so two runs never overlap.
let running = false;

// Returns the summary, or null if a run was already in progress.
// Errors are re-thrown so the admin route can report them; the schedule logs them.
export async function runDailyInventoryCheckOnce(trigger: string): Promise<DailyInventorySummary | null> {
  if (running) {
    console.log(`[jobs] Daily inventory check skipped (${trigger}): already running`);
    return null;
  }
  running = true;
  try {
    const summary = await runDailyInventoryCheck();
    console.log(`[jobs] Daily inventory check done (${trigger}):`, summary);
    return summary;
  } finally {
    running = false;
  }
}

function runInBackground(trigger: string): void {
  runDailyInventoryCheckOnce(trigger).catch((error: unknown) => {
    console.error(`[jobs] Daily inventory check failed (${trigger}):`, error);
  });
}

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  // 00:05 every day, Pakistan time: just after the date changes,
  // so batches reaching their stop-selling date come off sale first thing.
  const task = cron.schedule(
    '5 0 * * *',
    () => runInBackground('schedule'),
    { timezone: PKT_TIME_ZONE, name: 'daily-inventory', noOverlap: true }
  );
  tasks.push(task);

  // Also run once at startup, to catch up if the server was down at midnight.
  runInBackground('startup');

  console.log('[jobs] Scheduler started: daily inventory check at 00:05 PKT');
}

export function stopScheduler(): void {
  for (const task of tasks) {
    void task.stop();
  }
  tasks.length = 0;
}
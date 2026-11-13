// Fake-order protection: STARTING values (requirements 4.6). The admin changes them in Settings.
export const DEFAULT_RISK_RULES = {
  refusalThreshold: 2, // refused or uncollected parcels at or above this = high risk
  dailyOrderLimit: 3, // orders per phone number per day (Pakistan time)
} as const;
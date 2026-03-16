import type { CostSignal } from '@factory/types'

export async function getCostSignal(): Promise<CostSignal> {
  const hour = new Date().getUTCHours()
  // Off-peak: 1–6am UTC
  if (hour >= 1 && hour <= 6) return 'low'
  return 'medium'
}

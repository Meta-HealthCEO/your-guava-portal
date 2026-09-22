import type { ForecastItem } from '@/types'

/**
 * Below this many units a day, day-to-day randomness swamps the forecast
 * (backtested error above 100%), so the number is noise dressed as a plan.
 */
export const OCCASIONAL_SELLER_MAX_QTY = 2

/**
 * Whether an item sells too rarely for its number to be ordered against.
 *
 * Judged on volume alone, from the unadjusted baseline where one exists.
 * `confidence` is not a proxy: the backend also caps it by evidence, so a
 * 20-a-day line with one week of matching history is `low` and would
 * otherwise be filed as "under 2 a day".
 */
export function isOccasionalSeller(item: Partial<ForecastItem> & Pick<ForecastItem, 'predictedQty'>): boolean {
  return (item.baseQty ?? item.predictedQty) < OCCASIONAL_SELLER_MAX_QTY
}

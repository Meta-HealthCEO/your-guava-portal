import type { Forecast } from '@/types'
import { forecastDateKey, parseDateOnly } from '@/lib/date'

/**
 * States what a prediction is actually built from.
 *
 * The engine already computes this and the API already sends it — every
 * forecast carries `trainingData` — but nothing rendered it, so the only
 * answer the product gave to "why 22?" was a list of factors that did nothing.
 * On a Starter plan with no coordinates that is seven rows of "no effect": it
 * reads as a broken model rather than a confident one. The honest and
 * reassuring answer was sitting in the payload the whole time.
 */
export function forecastBasisSentence(
  forecast: Pick<Forecast, 'date' | 'dateKey' | 'trainingData'>
): string | null {
  const training = forecast.trainingData
  if (!training) return null

  const weekday = parseDateOnly(forecastDateKey(forecast)).toLocaleDateString('en-ZA', {
    weekday: 'long',
  })
  const weeks = training.weeksWithSales
  const head =
    typeof weeks === 'number' && weeks > 0
      ? `A weighted average of your last ${weeks} matching ${weekday}${weeks === 1 ? '' : 's'}`
      : `A weighted average of your matching ${weekday}s`

  const detail: string[] = []
  if (typeof training.transactionCount === 'number' && training.transactionCount > 0) {
    detail.push(`${training.transactionCount.toLocaleString('en-ZA')} sales on record`)
  }
  if (training.lastTransactionDate) {
    detail.push(
      `most recent ${parseDateOnly(training.lastTransactionDate).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`
    )
  }

  return detail.length > 0 ? `${head} (${detail.join(', ')}).` : `${head}.`
}

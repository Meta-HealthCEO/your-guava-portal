/**
 * One grading for forecast accuracy, shared by every surface that shows it.
 *
 * DayCard graded at >=85 / >=70 while WeekHeader graded the same metric at
 * >=80 / >=60, so an 82% day card read amber beside an 82% week header reading
 * green — one number, two verdicts, within a single screenful. Today's badge
 * did not grade at all: it was hard-coded green, so 41% and 94% looked alike.
 */
export type AccuracyBand = 'strong' | 'fair' | 'weak'

export const ACCURACY_STRONG_MIN = 80
export const ACCURACY_FAIR_MIN = 60

/**
 * The minimum number of matched days before an average accuracy is worth a
 * verdict. Below this the figure is one or two days of luck, not a track
 * record, and labelling it "Strong" invites the owner to trust the product on
 * evidence that does not exist.
 */
export const ACCURACY_MIN_SAMPLE = 5

export function accuracyBand(value: number): AccuracyBand {
  if (value >= ACCURACY_STRONG_MIN) return 'strong'
  if (value >= ACCURACY_FAIR_MIN) return 'fair'
  return 'weak'
}

export const ACCURACY_BAND_LABEL: Record<AccuracyBand, string> = {
  strong: 'Strong',
  fair: 'Fair',
  weak: 'Weak',
}

export function accuracyTextClass(value: number | null | undefined): string {
  if (value == null) return 'text-muted'
  const band = accuracyBand(value)
  if (band === 'strong') return 'text-guava-green'
  if (band === 'fair') return 'text-guava-yellow'
  return 'text-guava-red-text'
}

export function accuracyBadgeVariant(value: number): 'success' | 'warning' | 'destructive' {
  const band = accuracyBand(value)
  if (band === 'strong') return 'success'
  if (band === 'fair') return 'warning'
  return 'destructive'
}

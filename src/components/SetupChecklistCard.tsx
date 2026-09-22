import { useState } from 'react'
import { Link } from 'react-router'
import { X, ArrowRight } from 'lucide-react'

export interface SetupItem {
  id: string
  label: string
  href: string
}

export const SETUP_DISMISSED_KEY = 'guava.setup.dismissed'

/**
 * Per-viewer and best-effort: private windows and blocked site data throw on
 * access, and a setup hint is not worth taking the dashboard down for.
 */
function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(SETUP_DISMISSED_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

/**
 * The two settings a cafe can finish its first upload without, both of which
 * quietly cost it forecast quality: no coordinates means the weather factor
 * never applies, and a weekday marked closed that has sales forecasts zero
 * every week.
 *
 * Both are already stated where they bite — on the weather card, on the day
 * card, in Settings. What was missing is a single place, on the screen a new
 * owner actually opens, that says the work is outstanding at all.
 *
 * Dismissal is remembered per item, not per card: dismissing "I know about the
 * location" must not silence a contradiction an upload uncovers a fortnight
 * later.
 */
export function SetupChecklistCard({ items }: { items: SetupItem[] }) {
  const [dismissed, setDismissed] = useState<string[]>(readDismissed)

  const outstanding = items.filter((item) => !dismissed.includes(item.id))
  if (outstanding.length === 0) return null

  const dismiss = () => {
    const next = [...new Set([...dismissed, ...outstanding.map((item) => item.id)])]
    setDismissed(next)
    try {
      localStorage.setItem(SETUP_DISMISSED_KEY, JSON.stringify(next))
    } catch {
      // Not remembering the dismissal is a far smaller problem than throwing.
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-guava-yellow/30 bg-guava-yellow/[0.07] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text">Finish setting up</p>
          <p className="mt-0.5 text-xs text-muted">
            {outstanding.length === 1
              ? 'One setting is holding your forecasts back.'
              : `${outstanding.length} settings are holding your forecasts back.`}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss setup checklist"
          className="rounded-md p-1 text-muted transition-colors hover:bg-white/5 hover:text-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {outstanding.map((item) => (
          <li key={item.id}>
            <Link
              to={item.href}
              className="group flex items-start gap-2 text-sm text-text underline-offset-4 hover:underline"
            >
              <ArrowRight
                className="mt-0.5 h-4 w-4 shrink-0 text-guava-yellow transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

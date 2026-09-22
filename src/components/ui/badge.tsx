import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tinted badge grounds are opaque tokens rather than /20 alpha fills: an alpha
// fill composites with whatever card it lands on, which is how the Factors
// badges measured 3.78 and the Billing "Current" badge 3.94. The tokens give a
// fixed 4.78 (red) / 4.66 (green) regardless of the surface underneath.
const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-guava-red focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-guava-red-surface text-guava-red-text',
        secondary:
          'border-transparent bg-surface-2 text-muted',
        destructive:
          'border-transparent bg-red-900/30 text-red-400',
        outline:
          'border-border text-muted',
        success:
          'border-transparent bg-guava-green-surface text-guava-green',
        warning:
          'border-transparent bg-guava-yellow/20 text-guava-yellow',
        pro:
          'border-transparent bg-guava-red-surface text-guava-red-text uppercase tracking-wide',
        basic:
          'border-transparent bg-surface-2 text-muted uppercase tracking-wide',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

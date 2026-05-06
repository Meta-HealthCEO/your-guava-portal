import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-guava-red focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-guava-red/20 text-guava-red',
        secondary:
          'border-transparent bg-surface-2 text-muted',
        destructive:
          'border-transparent bg-red-900/30 text-red-400',
        outline:
          'border-border text-muted',
        success:
          'border-transparent bg-guava-green/20 text-guava-green',
        warning:
          'border-transparent bg-guava-yellow/20 text-guava-yellow',
        pro:
          'border-transparent bg-guava-red/20 text-guava-red uppercase tracking-wide',
        basic:
          'border-transparent bg-border text-muted uppercase tracking-wide',
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

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#D43D3D] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#D43D3D]/20 text-[#D43D3D]',
        secondary:
          'border-transparent bg-[#222222] text-[#888888]',
        destructive:
          'border-transparent bg-red-900/30 text-red-400',
        outline:
          'border-[#2A2A2A] text-[#888888]',
        success:
          'border-transparent bg-[#4DA63B]/20 text-[#4DA63B]',
        warning:
          'border-transparent bg-[#FFD166]/20 text-[#FFD166]',
        pro:
          'border-transparent bg-[#D43D3D]/20 text-[#D43D3D] uppercase tracking-wide',
        basic:
          'border-transparent bg-[#2A2A2A] text-[#888888] uppercase tracking-wide',
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

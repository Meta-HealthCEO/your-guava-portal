import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-guava-red focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-guava-red text-white hover:bg-[#BF3636] active:bg-[#A82F2F]',
        destructive:
          'bg-red-900/30 text-red-400 border border-red-900/50 hover:bg-red-900/50',
        outline:
          'border border-border bg-transparent text-text hover:bg-white/5 hover:border-[#3A3A3A]',
        secondary:
          'bg-surface-2 text-text border border-border hover:bg-border',
        ghost:
          'text-muted hover:bg-white/5 hover:text-text',
        link:
          'text-guava-red underline-offset-4 hover:underline',
        success:
          'bg-guava-green text-white hover:bg-[#3E8F2E] active:bg-[#337826]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-lg px-3 text-xs',
        lg: 'h-11 rounded-lg px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }

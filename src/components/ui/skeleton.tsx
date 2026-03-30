import * as React from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-[#2A2A2A] animate-[skeleton-shimmer_1.5s_infinite_linear]',
        className
      )}
      style={{
        backgroundImage: 'linear-gradient(90deg, #2A2A2A 0%, #333333 50%, #2A2A2A 100%)',
        backgroundSize: '200% 100%',
      }}
      {...props}
    />
  )
}

export { Skeleton }

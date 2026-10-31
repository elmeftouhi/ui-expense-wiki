import React from 'react'
import type { StreamStatus } from '../types'
import { cn } from '@/lib/utils'

interface LiveStreamBadgeProps {
  status: StreamStatus
  className?: string
}

export const LiveStreamBadge: React.FC<LiveStreamBadgeProps> = ({ status, className }) => {
  if (status === 'idle') return null

  const isOnline = status === 'online'
  const isConnecting = status === 'connecting' || status === 'reconnecting'

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border select-none transition-colors',
        isOnline && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
        isConnecting && 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
        status === 'offline' && 'border-border/80 bg-muted/50 text-muted-foreground',
        className,
      )}
      title={
        isOnline
          ? 'Real-time SSE stream connected'
          : isConnecting
            ? 'Connecting to real-time stream...'
            : 'Real-time stream offline. Polling fallback active.'
      }
    >
      <span className="relative flex h-1.5 w-1.5">
        {isOnline && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            'relative inline-flex rounded-full h-1.5 w-1.5',
            isOnline && 'bg-emerald-500',
            isConnecting && 'bg-amber-500 animate-pulse',
            status === 'offline' && 'bg-muted-foreground',
          )}
        />
      </span>
      <span>
        {isOnline ? 'Live' : isConnecting ? 'Connecting' : 'Offline'}
      </span>
    </div>
  )
}


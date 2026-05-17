import * as React from 'react'
import type { ReactNode } from 'react'

type StatusMessageVariant = 'success' | 'error'

interface StatusMessageProps {
  children: ReactNode
  variant: StatusMessageVariant
}

const statusStyles = {
  success: {
    background: '#d4edda',
    color: '#155724',
  },
  error: {
    background: '#f8d7da',
    color: '#721c24',
  },
}

export const StatusMessage = ({ children, variant }: StatusMessageProps) => {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      style={{
        ...statusStyles[variant],
        padding: 12,
        borderRadius: 6,
        marginBottom: 20,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  )
}

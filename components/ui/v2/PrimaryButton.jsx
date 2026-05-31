import React from 'react'
import { Button } from '@/components/ui/button'

export default function PrimaryButton({ children, className = '', ...props }) {
  return (
    <Button variant="primary" size="default" className={`rounded-2xl ${className}`} {...props}>
      {children}
    </Button>
  )
}

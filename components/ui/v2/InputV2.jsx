import React from 'react'
import { Input } from '@/components/ui/input'

export default function InputV2(props) {
  return (
    <Input {...props} className={`${props.className || ''} h-12 rounded-xl`} />
  )
}

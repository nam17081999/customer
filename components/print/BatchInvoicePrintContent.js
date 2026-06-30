import { forwardRef } from 'react'
import InvoicePrintContent from './InvoicePrintContent'

const BatchInvoicePrintContent = forwardRef(function BatchInvoicePrintContent({ invoices, userEmail }, ref) {
  if (!invoices || invoices.length === 0) return null

  return (
    <div ref={ref}>
      {invoices.map((invoice, idx) => (
        <div key={invoice.order?.id || idx} style={{ pageBreakAfter: idx < invoices.length - 1 ? 'always' : 'auto' }}>
          <InvoicePrintContent invoice={invoice} order={invoice.order} userEmail={userEmail} />
        </div>
      ))}
    </div>
  )
})

export default BatchInvoicePrintContent

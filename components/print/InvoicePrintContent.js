import { forwardRef } from 'react'
import { formatMoney } from '@/helper/inventoryFormat'
import { formatInventoryQuantity } from '@/helper/orderInventoryFlow'

function formatDateOnly(value) {
  if (!value) return '.../.../......'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '.../.../......'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function HalfInvoice({ invoice, order, label }) {
  const lines = invoice?.lines || []
  return (
    <div className="half">
      {/* HEADER: company + invoice meta */}
      <table className="top-table" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td className="half-brand">
              NPP HÀ CÔNG<br />
              <span className="half-brand-sub">Phân phối nước ngọt &amp; bánh kẹo</span>
            </td>
            <td className="half-meta">
              <span className="half-label">{label}</span><br />
              <span className="half-code">{order.code}</span><br />
              <span className="half-date">{formatDateOnly(order.created_at)}</span>
            </td>
          </tr>
        </tbody>
      </table>

      {/* CUSTOMER */}
      <div className="half-customer">
        <table cellPadding="0" cellSpacing="0">
          <tbody>
            <tr>
              <td className="half-cust-left">
                <strong>{invoice.customerName}</strong>
              </td>
              <td className="half-cust-right">
                {invoice.customerPhone && <span>Sđt: {invoice.customerPhone}</span>}
              </td>
            </tr>
          </tbody>
        </table>
        <div className="half-cust-addr">
          {invoice.customerAddress && <span>Địa chỉ: {invoice.customerAddress}</span>}
        </div>
        {order.note && <div className="half-cust-note">Ghi chú: {order.note}</div>}
      </div>

      {/* ITEMS TABLE */}
      <table className="items-table" cellPadding="0" cellSpacing="0">
        <thead>
          <tr>
            <th className="col-stt">STT</th>
            <th className="col-name">Hàng hóa</th>
            <th className="col-dvt c">ĐVT</th>
            <th className="col-qty">SL</th>
            <th className="col-price">Đơn giá</th>
            <th className="col-total">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={line.id} className={idx === lines.length - 1 ? 'item last' : 'item'}>
              <td className="c">{idx + 1}</td>
              <td>{line.productName}</td>
              <td className="c">{line.unitName || ''}</td>
              <td className="r">{formatInventoryQuantity(line.quantity)}</td>
              <td className="r">{formatMoney(line.unitPrice)}</td>
              <td className="r">{formatMoney(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* TOTAL */}
      <table className="total-table" cellPadding="0" cellSpacing="0">
        <tbody>
          <tr>
            <td className="total-label"><strong>Tổng tiền thanh toán</strong></td>
            <td className="total-amount"><strong>{formatMoney(order.total_amount)}</strong></td>
          </tr>
        </tbody>
      </table>

      {/* PAYMENT INFO */}
      <div className="half-payment">
        <table cellPadding="0" cellSpacing="0">
          <tbody>
            <tr>
              <td className="pay-left">
                <span className="pay-title">Thanh toán chuyển khoản</span>
                <span className="pay-detail">
                  <strong>TK:</strong> <span className="acc">{invoice.paymentInfo.accountNumber}</span>
                </span>
                <span className="pay-detail">
                  <strong>NH:</strong> {invoice.paymentInfo.bankName}
                </span>
                <span className="pay-detail">
                  <strong>CTK:</strong> NPP HÀ CÔNG
                </span>
              </td>
              <td className="pay-right">
                <img src={invoice.paymentQrUrl} alt="" className="qr" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const InvoicePrintContent = forwardRef(function InvoicePrintContent({ invoice, order, userEmail }, ref) {
  if (!invoice || !order) return null

  return (
    <div ref={ref} className="inv-wrap">
      <style>{`
        .inv-wrap {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          color: #333;
          background: #fff;
          width: 297mm;
          height: 210mm;
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr 1fr;
          position: relative;
        }
        .inv-wrap::after {
          content: '';
          position: absolute;
          left: 50%; top: 5mm; bottom: 5mm;
          width: 0;
          border-left: 1.5px dashed #bbb;
        }

        /* ========== HALF ========== */
        .inv-wrap .half {
          padding: 10mm 8mm;
          display: flex;
          flex-direction: column;
          height: 210mm;
          box-sizing: border-box;
          overflow: hidden;
        }
        .inv-wrap .half .top-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 7mm;
        }
        .inv-wrap .half .top-table td { vertical-align: top; }
        .inv-wrap .half .half-brand {
          font-size: 14pt;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #222;
        }
        .inv-wrap .half .half-brand-sub {
          font-size: 7pt;
          font-weight: 400;
          color: #888;
          letter-spacing: 0;
        }
        .inv-wrap .half .half-meta {
          text-align: right;
          font-size: 7.5pt;
          color: #666;
          line-height: 1.6;
          white-space: nowrap;
        }
        .inv-wrap .half .half-label {
          font-size: 8pt;
          font-weight: 700;
          color: #999;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .inv-wrap .half .half-code {
          font-weight: 700;
          color: #333;
          font-size: 8pt;
        }
        .inv-wrap .half .half-date {
          color: #888;
        }

        /* CUSTOMER */
        .inv-wrap .half .half-customer {
          background: #f5f5f5;
          padding: 4mm 5mm;
          margin-bottom: 4mm;
          border-radius: 2px;
        }
        .inv-wrap .half .half-customer table { width: 100%; }
        .inv-wrap .half .half-customer td { vertical-align: top; }
        .inv-wrap .half .half-cust-left { font-size: 9pt; color: #222; }
        .inv-wrap .half .half-cust-right { text-align: right; font-size: 7.5pt; color: #555; white-space: nowrap; }
        .inv-wrap .half .half-cust-addr { font-size: 7.5pt; color: #666; margin-top: 1mm; }
        .inv-wrap .half .half-cust-note {
          margin-top: 1.5mm;
          font-size: 7.5pt;
          color: #866;
          border-top: 0.5px solid #ddd;
          padding-top: 1.5mm;
        }

        /* ITEMS TABLE */
        .inv-wrap .half .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 7.5pt;
          flex-shrink: 0;
        }
        .inv-wrap .half .items-table thead th {
          background: #eee;
          color: #444;
          font-weight: 700;
          padding: 2.5mm 2mm;
          border-bottom: 1.5px solid #ccc;
          text-align: left;
        }
        .inv-wrap .half .items-table thead th.c,
        .inv-wrap .half .items-table tbody td.c { text-align: center; }
        .inv-wrap .half .items-table thead th.r,
        .inv-wrap .half .items-table tbody td.r { text-align: right; }
        .inv-wrap .half .items-table tbody td {
          padding: 1.8mm 2mm;
          border-bottom: 0.5px solid #e5e5e5;
          vertical-align: middle;
          white-space: nowrap;
        }
        .inv-wrap .half .items-table tbody td.col-name {
          white-space: normal;
        }
        .inv-wrap .half .items-table tbody tr.last td { border-bottom: none; }
        .inv-wrap .half .items-table .col-stt { width: 7mm; text-align: center; }
        .inv-wrap .half .items-table .col-name { }
        .inv-wrap .half .items-table .col-dvt { width: 9mm; text-align: center; }
        .inv-wrap .half .items-table .col-qty { width: 10mm; text-align: right; }
        .inv-wrap .half .items-table .col-price { width: 17mm; text-align: right; }
        .inv-wrap .half .items-table .col-total { width: 19mm; text-align: right; }
        .inv-wrap .half .items-table .sku { color: #888; font-size: 6.5pt; }

        /* TOTAL */
        .inv-wrap .half .total-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 2mm;
          flex-shrink: 0;
        }
        .inv-wrap .half .total-table td {
          padding: 2mm 2mm;
          border-top: 2px solid #333;
          font-size: 9pt;
        }
        .inv-wrap .half .total-table .total-label { text-align: left; }
        .inv-wrap .half .total-table .total-amount { text-align: right; font-size: 10pt; }

        /* PAYMENT */
        .inv-wrap .half .half-payment {
          margin-top: auto;
          flex-shrink: 0;
          padding-top: 3mm;
        }
        .inv-wrap .half .half-payment table { width: 100%; }
        .inv-wrap .half .half-payment td { vertical-align: middle; }
        .inv-wrap .half .pay-left {
          font-size: 6.5pt;
          line-height: 1.5;
          color: #555;
        }
        .inv-wrap .half .pay-title {
          font-size: 7pt;
          font-weight: 700;
          color: #444;
          display: block;
          margin-bottom: 0.5mm;
        }
        .inv-wrap .half .pay-detail {
          display: block;
        }
        .inv-wrap .half .acc {
          font-family: 'Courier New', monospace;
          font-weight: 700;
          font-size: 8pt;
          letter-spacing: 0.03em;
          color: #333;
        }
        .inv-wrap .half .pay-right { text-align: right; width: 22mm; }
        .inv-wrap .half .qr {
          width: 18mm;
          height: 18mm;
          border: 0.5px solid #ddd;
          object-fit: contain;
          padding: 1mm;
        }

      `}</style>
      <HalfInvoice invoice={invoice} order={order} label="ĐƠN GIAO" />
      <HalfInvoice invoice={invoice} order={order} label="ĐƠN LƯU" />
    </div>
  )
})

export default InvoicePrintContent

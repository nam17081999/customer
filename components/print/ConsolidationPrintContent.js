import { forwardRef } from 'react'

function formatDateOnly(value) {
  if (!value) return '.../.../......'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '.../.../......'
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const ConsolidationPrintContent = forwardRef(function ConsolidationPrintContent({ selectedOrders, consolidationData, dateFrom, dateTo, userEmail }, ref) {
  if (!consolidationData || consolidationData.length === 0) return null

  return (
    <div ref={ref} className="consol-print-root">
      <style>{`
        .consol-print-root {
          font-family: 'Times New Roman', Times, serif;
          font-size: 13px;
          color: #000;
          background: #fff;
          padding: 24px 20px;
          max-width: 210mm;
          margin: 0 auto;
        }
        .consol-print-root .header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 2px solid #222;
        }
        .consol-print-root .header h1 {
          font-size: 16pt;
          font-weight: 700;
          margin: 0 0 4px 0;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .consol-print-root .header p {
          font-size: 10pt;
          margin: 2px 0;
          color: #444;
        }
        .consol-print-root .title {
          text-align: center;
          font-size: 14pt;
          font-weight: 700;
          margin: 14px 0 2px;
          text-transform: uppercase;
        }
        .consol-print-root .subtitle {
          text-align: center;
          font-size: 10pt;
          color: #555;
          margin: 0 0 14px;
        }
        .consol-print-root .info {
          font-size: 9pt;
          margin-bottom: 10px;
          text-align: right;
          color: #555;
        }
        .consol-print-root table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5pt;
        }
        .consol-print-root thead tr {
          background: #e8e8e8;
        }
        .consol-print-root th {
          font-weight: 700;
          padding: 6px 10px;
          border: 1px solid #888;
          text-align: left;
        }
        .consol-print-root th.stt { width: 36px; text-align: center; }
        .consol-print-root th.qty { width: 70px; text-align: right; }
        .consol-print-root td {
          padding: 5px 10px;
          border: 1px solid #bbb;
        }
        .consol-print-root td.stt { text-align: center; color: #555; }
        .consol-print-root td.qty { text-align: right; font-weight: 600; }
        .consol-print-root tbody tr:nth-child(even) { background: #f7f7f7; }
        .consol-print-root .footer {
          margin-top: 20px;
          display: flex;
          justify-content: flex-end;
          gap: 48px;
          font-size: 10pt;
        }
        .consol-print-root .footer .sig { text-align: center; }
        .consol-print-root .footer .sig p { margin: 0; }
        .consol-print-root .footer .sig .label { font-size: 9pt; color: #555; }
        .consol-print-root .footer .sig .line {
          margin-top: 36px;
          padding-top: 4px;
          border-top: 1px solid #555;
          min-width: 100px;
          font-weight: 600;
        }
      `}</style>

      {/* Header */}
      <div className="header">
        <h1>Công Ty TNHH Phân Phối Hà Công</h1>
        <p>Địa chỉ: ................................................</p>
        <p>Điện thoại: ..............................................</p>
      </div>

      <div className="title">Tổng hợp hàng hóa</div>
      <div className="subtitle">(Dự kiến xuất kho)</div>

      <div className="info">
        <p>Ngày lập: {formatDateOnly(new Date().toISOString())}</p>
        {dateFrom && dateTo && <p>Kỳ: {dateFrom} → {dateTo}</p>}
        <p>Số đơn: <strong>{selectedOrders?.length || 0}</strong> đơn</p>
        <p>Người lập: {userEmail || '........................'}</p>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th className="stt">STT</th>
            <th>Tên sản phẩm</th>
            <th className="qty">Số lượng</th>
          </tr>
        </thead>
        <tbody>
          {consolidationData.map((row, index) => (
            <tr key={row.productName}>
              <td className="stt">{index + 1}</td>
              <td>{row.productName}</td>
              <td className="qty">{row.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="footer">
        <div className="sig">
          <p className="label">Người lập</p>
          <p className="line">{userEmail || '........................'}</p>
        </div>
        <div className="sig">
          <p className="label">Kế toán</p>
          <p className="line">........................</p>
        </div>
      </div>
    </div>
  )
})

export default ConsolidationPrintContent

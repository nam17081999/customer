export function DistrictChart({ districtRows, topDistrictCount }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>Cửa hàng theo huyện</h3>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{districtRows.length} huyện</span>
      </div>
      <div className="card-body">
        {districtRows.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>Chưa có dữ liệu cửa hàng.</p>
          </div>
        ) : (
          <div>
            {districtRows.slice(0, 8).map((row) => (
              <div key={row.district} className="district-row">
                <span className="district-name">{row.district}</span>
                <div className="district-bar-wrap">
                  <div className="district-bar-fill" style={{ width: `${Math.round((row.count / topDistrictCount) * 100)}%`, background: 'linear-gradient(90deg, var(--accent), oklch(62% 0.18 252))' }} />
                </div>
                <span className="district-count">{row.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

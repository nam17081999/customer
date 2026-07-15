export function DistrictChart({ districtRows, topDistrictCount }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-foreground">Cửa hàng theo huyện</h3>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{districtRows.length} huyện</span>
      </div>
      <div>
        {districtRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
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

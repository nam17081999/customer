function parseCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
      continue
    }
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === ',' && !quoted) {
      values.push(current)
      current = ''
      continue
    }
    current += char
  }
  values.push(current)
  return values
}

export function parseCsvContent(content) {
  const text = String(content || '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line)
    const row = { __rowNumber: index + 2 }
    headers.forEach((header, headerIndex) => { row[header] = values[headerIndex] ?? '' })
    return row
  })
  return { headers, rows }
}

export function validateProductImportRows(rows = []) {
  const seenSku = new Set()
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const errors = []
    const name = String(row.name || row.ten || row['Tên hàng'] || '').trim()
    const sku = String(row.sku || row.SKU || '').trim()
    const unit = String(row.base_unit_name || row.unit || row['Đơn vị'] || '').trim()
    const salePrice = Number(String(row.default_sale_price || row.sale_price || row['Giá bán'] || '0').replaceAll(',', '.'))
    if (!name) errors.push('Thiếu tên hàng')
    if (!unit) errors.push('Thiếu đơn vị gốc')
    if (!Number.isFinite(salePrice) || salePrice < 0) errors.push('Giá bán không hợp lệ')
    if (sku) {
      const key = sku.toLowerCase()
      if (seenSku.has(key)) errors.push('Trùng SKU trong file')
      seenSku.add(key)
    }
    return { rowNumber: row.__rowNumber, data: { name, sku, baseUnitName: unit, defaultSalePrice: salePrice }, errors }
  })
}

import { DISTRICT_WARD_SUGGESTIONS } from '@/lib/constants'

function normalizeText(value) {
  return String(value || '').trim()
}

export function filterMapStoresByAreaSelection(stores, selectedDistricts = [], selectedWards = []) {
  const source = Array.isArray(stores) ? stores : []
  if (!Array.isArray(selectedDistricts) || selectedDistricts.length === 0) return source

  const districtSet = new Set(selectedDistricts.map(normalizeText).filter(Boolean))
  const wardSet = new Set(selectedWards.map(normalizeText).filter(Boolean))

  return source.filter((store) => {
    const district = normalizeText(store?.district)
    const ward = normalizeText(store?.ward)
    if (!districtSet.has(district)) return false

    const districtWardOptions = DISTRICT_WARD_SUGGESTIONS[district] || []
    const selectedWardsInDistrict = districtWardOptions.filter((candidate) => wardSet.has(normalizeText(candidate)))

    if (selectedWardsInDistrict.length === 0) {
      return true
    }

    return selectedWardsInDistrict.includes(ward)
  })
}

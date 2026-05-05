import { describe, expect, it } from 'vitest'
import {
  collectAddressCandidates,
  findBestDistrict,
  findBestWard,
  inferDistrictWardFromOldWard,
  resolveDistrictWardFromCoordinates,
  resolveDistrictWardFromPayload,
} from '@/helper/storeAreaResolver'

describe('storeAreaResolver', () => {
  it('extracts old ward/district from Goong-style components', () => {
    const result = resolveDistrictWardFromPayload({
      provider: 'goong',
      components: [
        { long_name: 'An Khánh', short_name: 'An Khánh' },
        { long_name: 'Hoài Đức', short_name: 'Hoài Đức' },
        { long_name: 'Hà Nội', short_name: 'Hà Nội' },
      ],
    })

    expect(result.district).toBe('Hoài Đức')
    expect(result.ward).toBe('An Khánh')
    expect(result.provider).toBe('goong')
  })

  it('extracts district and ward from Nominatim-style address', () => {
    const result = resolveDistrictWardFromPayload({
      provider: 'nominatim',
      address: {
        suburb: 'An Khánh',
        city_district: 'Hoài Đức',
        city: 'Hà Nội',
      },
    })

    expect(result.district).toBe('Hoài Đức')
    expect(result.ward).toBe('An Khánh')
  })

  it('extracts district and ward from Geoapify-style address payload', () => {
    const result = resolveDistrictWardFromPayload({
      provider: 'geoapify',
      address: {
        suburb: 'Mỹ Đình 1',
        city_district: 'Nam Từ Liêm',
        city: 'Hà Nội',
        county: 'Hà Nội',
        country: 'Việt Nam',
      },
      formattedAddress: 'Mỹ Đình 1, Nam Từ Liêm, Hà Nội, Việt Nam',
    })

    expect(result.district).toBe('Nam Từ Liêm')
    expect(result.ward).toBe('Mỹ Đình 1')
    expect(result.provider).toBe('geoapify')
  })

  it('resolves old district and ward from internal seed data for supported coordinates', async () => {
    const result = await resolveDistrictWardFromCoordinates(21.07744026184082, 105.69537353515625)

    expect(result).toMatchObject({
      district: 'Hoài Đức',
      ward: 'Đức Thượng',
      source: 'boundary_lookup',
    })
  })

  it('returns unresolved when coordinates are outside supported seed areas', async () => {
    const result = await resolveDistrictWardFromCoordinates(10.762622, 106.660172)

    expect(result).toMatchObject({
      district: '',
      ward: '',
      source: 'boundary_unresolved',
    })
  })

  it('returns invalid source for invalid coordinates', async () => {
    await expect(resolveDistrictWardFromCoordinates(Number.NaN, 105.78)).resolves.toEqual({
      district: '',
      ward: '',
      source: 'invalid',
    })
  })

  it('infers old district from old ward when provider returns a newer or merged district name', () => {
    const result = resolveDistrictWardFromPayload({
      provider: 'goong',
      components: [
        { long_name: 'Từ Liêm', short_name: 'Từ Liêm' },
        { long_name: 'Hà Nội', short_name: 'Hà Nội' },
      ],
      formattedAddress: 'Số 1, Mỹ Đình 1, Từ Liêm, Hà Nội',
    })

    expect(result.district).toBe('Nam Từ Liêm')
    expect(result.ward).toBe('Mỹ Đình 1')
  })

  it('infers old district from old ward when old ward only appears in formatted address fragments', () => {
    const inferred = inferDistrictWardFromOldWard([
      'Số 1, Tây Mỗ, Từ Liêm, Hà Nội',
      'Từ Liêm',
      'Hà Nội',
    ])

    expect(inferred.district).toBe('Nam Từ Liêm')
    expect(inferred.ward).toBe('Tây Mỗ')
  })

  it('does not guess an ambiguous district when only merged district text is present', () => {
    expect(findBestDistrict(['Từ Liêm', 'Hà Nội'])).toBe('')
  })

  it('returns district only when ward is not in internal old list', () => {
    const result = resolveDistrictWardFromPayload({
      provider: 'goong',
      components: [
        { long_name: 'Xã Mới Sau Sáp Nhập', short_name: 'Xã Mới Sau Sáp Nhập' },
        { long_name: 'Hoài Đức', short_name: 'Hoài Đức' },
        { long_name: 'Hà Nội', short_name: 'Hà Nội' },
      ],
    })

    expect(result.district).toBe('Hoài Đức')
    expect(result.ward).toBe('')
  })

  it('collects candidates from both components and address', () => {
    const candidates = collectAddressCandidates({
      components: [{ long_name: 'An Khánh', short_name: 'An Khánh' }],
      address: { city_district: 'Hoài Đức' },
      displayName: 'An Khánh, Hoài Đức, Hà Nội',
    })

    expect(candidates).toContain('An Khánh')
    expect(candidates).toContain('Hoài Đức')
    expect(candidates).toContain('Hà Nội')
  })

  it('splits candidates by hyphen and en dash safely', () => {
    const candidates = collectAddressCandidates({
      formattedAddress: 'Mỹ Đình 1 - Nam Từ Liêm – Hà Nội',
    })

    expect(candidates).toContain('Mỹ Đình 1')
    expect(candidates).toContain('Nam Từ Liêm')
    expect(candidates).toContain('Hà Nội')
  })

  it('matches district and ward accent-insensitively', () => {
    expect(findBestDistrict(['Hoai Duc', 'Ha Noi'])).toBe('Hoài Đức')
    expect(findBestWard(['An Khanh'], 'Hoài Đức')).toBe('An Khánh')
  })
})


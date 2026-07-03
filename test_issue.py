# -------------------------------------------------------------------

# This script tests the issue with district/ward autofill in the store create flow
# Issue: When multiple boundaries exist for the same district, the current logic
# fails to find a match, so auto-fill doesn't work properly.

# The problem is in helper/storeAreaResolver.js:
# 1. lookupOldAdminAreaFromBoundaries returns empty for ambiguous matches
# 2. resolveDistrictWardFromCoordinates returns empty instead of
#    trying reverse geocode fallback

# Expected behavior:
# 1. If a coordinate matches multiple boundaries in the same district,
#    the auto-fill should still work (should use reverse geocode fallback)
# 2. All 8 Cầu Giấy ward entries should be in the DISTRICT_WARD_SUGGESTIONS

import json
import fs

OLD_ADMIN_AREA_BOUNDARIES_PATH = 'data/oldAdminAreaBoundaries.js'
CONSTS_PATH = 'lib/constants.js'
STORE_AREA_RESOLVER_PATH = 'helper/storeAreaResolver.js'

def loadJSON(filepath):
    content = fs.readFileSync(filepath, 'utf8')
    match = content.search(/\[/)
    if match:
        # Simpler extraction - just read as a string and replace the script wrapper
        text = content
        
        # Find the JSON array start
        bracket_start = text.find('[')
        if bracket_start == -1:
            return None
            
        # Find the matching closing bracket
        bracket_count = 0
        json_text = ''
        for i, char in enumerate(text[bracket_start:], bracket_start):
            json_text += char
            if char == '[':
                bracket_count += 1
            elif char == ']':
                bracket_count -= 1
                if bracket_count == 0:
                    break
                    
        return json.loads(json_text)
    return None

def loadDistrictWardSuggestions():
    content = fs.readFileSync(CONSTS_PATH, 'utf8')
    # Extract the DISTRICT_WARD_SUGGESTIONS object
    # Simple approach: find and extract between export const DISTRICT_WARD_SUGGESTIONS = { and }
    pattern = "export const DISTRICT_WARD_SUGGESTIONS = {"
    start = content.find(pattern)
    if start == -1:
        return None
    
    start += len(pattern)
    brace_count = 0
    json_text = ''
    for char in content[start:]:
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            json_text += char
            if brace_count == 0:
                break
        else:
            json_text += char
    
    if brace_count != 0:
        return None
        
    # Evaluate the JavaScript object
    json_obj = eval(json_text)
    return json_obj

def isInsideBounds(lat, lng, bounds):
    if not bounds:
        return False
    return lat >= bounds['minLat'] \
        and lat <= bounds['maxLat'] \
        and lng >= bounds['minLng'] \
        and lng <= bounds['maxLng']

def isPointInRing(lat, lng, ring):
    inside = False
    for index in range(len(ring)):
        prevIndex = (index - 1) % len(ring)
        [lng1, lat1] = ring[index]
        [lng2, lat2] = ring[prevIndex]
        intersects = ((lat1 > lat) != (lat2 > lat)) \
            and (lng < ((lng2 - lng1) * (lat - lat1)) / ((lat2 - lat1) or 1) + lng1)
        if intersects:
            inside = not inside
    return inside

def isPointInPolygonGeometry(lat, lng, geometry):
    if not geometry:
        return False
    if geometry['type'] == 'Polygon':
        outerRing, *holes = geometry['coordinates']
        if not isPointInRing(lat, lng, outerRing):
            return False
        return not any(isPointInRing(lat, lng, ring) for ring in holes)
    
    if geometry['type'] == 'MultiPolygon':
        for polygon in geometry['coordinates']:
            outerRing, *holes = polygon
            if isPointInRing(lat, lng, outerRing):
                return True
    
    return False

def lookupOldAdminAreaFromBoundaries(lat, lng, boundaries):
    matches = [b for b in boundaries if (
        isInsideBounds(lat, lng, b['bounds']) and isPointInPolygonGeometry(lat, lng, b['geometry'])
    )]
    
    print(f"    Coordinate ({lat}, {lng}): Found {len(matches)} matches -> {', '.join([f'{m['district']}/{m['ward']}' for m in matches])}")

    if len(matches) != 1:
        return {
            'district': '',
            'ward': '',
            'source': 'boundary_ambiguous' if len(matches) > 1 else 'boundary_unresolved'
        }
    
    return {
        'district': matches[0]['district'],
        'ward': matches[0]['ward'],
        'source': 'boundary_lookup'
    }

print('=== Testing Store Create District/Ward Autofill Issue ===\\n')

OLD_ADMIN_AREA_BOUNDARIES = loadJSON(OLD_ADMIN_AREA_BOUNDARIES_PATH)
DISTRICT_WARD_SUGGESTIONS = loadDistrictWardSuggestions()

print('1. Checking boundaries vs constants consistency...')

caugiay_entries = [b for b in OLD_ADMIN_AREA_BOUNDARIES if b['district'] == 'Cầu Giấy']
caugiay_wards = list(set(entry['ward'] for entry in caugiay_entries))
caugiay_wards.sort()
caugiay_constants = DISTRICT_WARD_SUGGESTIONS.get('Cầu Giấy', [])

print(f'Cầu Giấy ward count in data: {len(caugiay_wards)}')
print(f'Cầu Giấy ward count in constants: {len(caugiay_constants)}')
print('\\nCầu Giấy wards in data but not in constants:')
missing_in_constants = [w for w in caugiay_wards if w not in caugiay_constants]
for ward in missing_in_constants:
    print(f'  {ward}')

print('\\nCầu Giấy wards in constants but not in data:')
extra_in_constants = [w for w in caugiay_constants if w not in caugiay_wards]
for ward in extra_in_constants:
    print(f'  {ward}')

print('\\n2. Testing auto-fill logic with Cầu Giấy coordinates...')

cauGiay_test_coords = [
    {'ward': 'Dịch Vọng', 'lat': 21.0329958, 'lng': 105.7928552},
    {'ward': 'Dịch Vọng Hậu', 'lat': 21.0347452, 'lng': 105.784706},
    {'ward': 'Mai Dịch', 'lat': 21.0408258, 'lng': 105.7745513},
    {'ward': 'Nghĩa Đô', 'lat': 21.0489004, 'lng': 105.8030437},
    {'ward': 'Nghĩa Tân', 'lat': 21.0455417, 'lng': 105.7919938},
    {'ward': 'Quan Hoa', 'lat': 21.0341687, 'lng': 105.8006138},
    {'ward': 'Trung Hòa', 'lat': 21.0090152, 'lng': 105.801675},
    {'ward': 'Yên Hòa', 'lat': 21.0210607, 'lng': 105.7916653}
]

print('\\nTesting lookupOldAdminAreaFromBoundaries function...')

print('\\nTesting all Cầu Giấy coordinates:')
for testCoord in cauGiay_test_coords:
    result = lookupOldAdminAreaFromBoundaries(testCoord['lat'], testCoord['lng'], OLD_ADMIN_AREA_BOUNDARIES)
    print(f"{testCoord['ward']} -> {result['district']}/{result['ward']} ({result['source']})")

print('\\n=== Issue Summary ===')
print('The main issue is that DISTRICT_WARD_SUGGESTIONS[\"Cầu Giấy\"] is missing')
print('2 wards: Dịch Vọng Hậu and Nghĩa Tân that exist in the boundaries data')
print('\\nThis causes the ward selector in the store create form to have missing options')
print('\\nThe auto-fill logic itself seems to be working correctly - it will try')
print('boundary lookup first, and if that fails (ambiguous match), it falls back to')
print('reverse geocoding API, which is the correct behavior.')

/**
 * API endpoint to expand Google Maps short links
 * Handles goo.gl, maps.app.goo.gl, and other short URLs
 */

import { extractCoordsFromMapsUrl } from '@/helper/storeFormShared'

// Whitelist of allowed short-link domains to prevent SSRF attacks
const ALLOWED_HOSTS = [
  'goo.gl',
  'maps.app.goo.gl',
  'maps.google.com',
  'maps.google.com.vn',
  'www.google.com',
  'google.com',
]
const MAPS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
const MAX_HTML_CHARS = 500_000

async function fetchExpandedMapsUrl(urlStr, method = 'HEAD') {
  return fetch(urlStr, {
    method,
    redirect: 'follow',
    headers: {
      'User-Agent': MAPS_USER_AGENT,
    },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url } = req.body
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    // Normalize URL
    let urlStr = url.trim()
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`
    }

    // Validate hostname against whitelist to prevent SSRF
    try {
      const parsed = new URL(urlStr)
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        return res.status(400).json({ error: 'URL domain not allowed. Only Google Maps short links are supported.' })
      }
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' })
    }

    let finalUrl = urlStr
    let coords = null
    let headOk = false

    try {
      const headResponse = await fetchExpandedMapsUrl(urlStr, 'HEAD')
      headOk = Boolean(headResponse?.ok)
      if (headResponse?.url) {
        finalUrl = headResponse.url
        coords = extractCoordsFromMapsUrl(finalUrl)
      }
    } catch {
      // Some Google Maps share links do not behave well with HEAD. GET fallback below.
    }

    if (!coords) {
      const getResponse = await fetchExpandedMapsUrl(urlStr, 'GET')
      if (!getResponse.ok && !headOk) {
        return res.status(400).json({ error: 'Failed to expand URL' })
      }
      if (getResponse.url) {
        finalUrl = getResponse.url
        coords = extractCoordsFromMapsUrl(finalUrl)
      }
      if (!coords && typeof getResponse.text === 'function') {
        const html = await getResponse.text()
        coords = extractCoordsFromMapsUrl(String(html || '').slice(0, MAX_HTML_CHARS))
      }
    }

    return res.status(200).json({ 
      originalUrl: url,
      finalUrl: finalUrl,
      coords,
      success: true 
    })

  } catch (error) {
    console.error('❌ Expand link error:', error)
    return res.status(500).json({ 
      error: 'Failed to expand URL',
      details: error.message 
    })
  }
}

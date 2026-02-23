/**
 * API endpoint to expand Google Maps short links
 * Handles goo.gl, maps.app.goo.gl, and other short URLs
 */

// Whitelist of allowed short-link domains to prevent SSRF attacks
const ALLOWED_HOSTS = [
  'goo.gl',
  'maps.app.goo.gl',
  'maps.google.com',
  'maps.google.com.vn',
  'www.google.com',
  'google.com',
]

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

    // Follow redirects to get final URL
    const response = await fetch(urlStr, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    })

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to expand URL' })
    }

    const finalUrl = response.url

    return res.status(200).json({ 
      originalUrl: url,
      finalUrl: finalUrl,
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

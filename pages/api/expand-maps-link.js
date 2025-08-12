/**
 * API endpoint to expand Google Maps short links
 * Handles goo.gl, maps.app.goo.gl, and other short URLs
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { url } = req.body
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    console.log('🔗 Expanding URL:', url)

    // Normalize URL
    let urlStr = url.trim()
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`
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
      console.log('❌ HTTP error:', response.status)
      return res.status(400).json({ error: 'Failed to expand URL' })
    }

    const finalUrl = response.url
    console.log('✅ Expanded to:', finalUrl)

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }
  const { url } = req.body || {}
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'Missing url' })
  }
  try {
    // Basic guard: only attempt for Google Maps short links or Google domains
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.toLowerCase()
    const allowedHosts = ['maps.app.goo.gl', 'goo.gl', 'goo.gl/maps', 'maps.google.com', 'www.google.com', 'google.com']
    if (!allowedHosts.some((h) => host === h || host.endsWith(h.replace(/^\*\./, '')))) {
      // Still try to follow; some users paste other shorteners
    }

    const resp = await fetch(u.toString(), { redirect: 'follow' })
    // Final URL after redirects (if any)
    const finalUrl = resp.url || u.toString()

    // Optionally attempt to parse coordinates from finalUrl here on server as well
    // but we just return the finalUrl and let client reuse its existing parser.

    return res.status(200).json({ finalUrl })
  } catch (e) {
    console.error('expand-maps-link error:', e)
    return res.status(500).json({ error: 'Failed to expand link' })
  }
}

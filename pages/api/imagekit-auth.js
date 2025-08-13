import { getAuthenticationParameters } from '@/lib/imagekit';

/**
 * Get ImageKit authentication parameters for client-side uploads
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authParams = await getAuthenticationParameters();
    res.status(200).json(authParams);
  } catch (error) {
    console.error('Auth API error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get authentication parameters' 
    });
  }
}

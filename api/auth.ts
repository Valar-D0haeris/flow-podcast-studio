import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { password } = req.body || {};
    // Default master password is 'flow2026' or configured in environment
    const masterPassword = process.env.APP_ACCESS_PASSWORD || process.env.ADMIN_PASSWORD || 'flow2026';

    if (!password) {
      return res.status(400).json({ error: 'Mot de passe requis' });
    }

    if (password.trim() !== masterPassword.trim()) {
      return res.status(401).json({ error: 'Code d\'accès incorrect' });
    }

    // Generate a simple deterministic token
    const tokenPayload = Buffer.from(`flow_auth_${Date.now()}_${masterPassword}`).toString('base64');

    return res.status(200).json({
      success: true,
      token: tokenPayload,
      message: 'Authentification réussie'
    });
  } catch (err: any) {
    console.error('[auth] error:', err);
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}

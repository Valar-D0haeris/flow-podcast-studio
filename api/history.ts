import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Pool } from 'pg';

function getDbUrl(): string | undefined {
  // Strip channel_binding param which is not supported by the pg driver
  const raw = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return raw;
  }
}

const DB_URL = getDbUrl();
const pool = DB_URL ? new Pool({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
}) : null;

const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS generations (
    id            SERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    filename      TEXT NOT NULL,
    blob_url      TEXT NOT NULL,
    download_url  TEXT NOT NULL,
    duration_text TEXT,
    script_excerpt TEXT
  )
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  if (!pool) {
    return res.status(200).json({ items: [], postgres_configured: false });
  }

  try {
    await pool.query(CREATE_TABLE);

    const result = await pool.query(
      'SELECT id, created_at, filename, blob_url, download_url, duration_text, script_excerpt FROM generations ORDER BY created_at DESC LIMIT 50'
    );

    return res.status(200).json({
      items: result.rows,
      postgres_configured: true,
    });
  } catch (err: any) {
    console.error('[history] error:', err);
    return res.status(500).json({ error: err.message, items: [], postgres_configured: false });
  }
}

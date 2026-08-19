import type { VercelRequest, VercelResponse } from '@vercel/node';
import { del } from '@vercel/blob';
import { Pool } from 'pg';

function getDbUrl(): string | undefined {
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
    script_excerpt TEXT,
    script        TEXT
  );
  ALTER TABLE generations ADD COLUMN IF NOT EXISTS script TEXT;
  CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at DESC);
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!pool) {
    return res.status(200).json({ items: [], postgres_configured: false });
  }

  // DELETE a generation by ID
  if (req.method === 'DELETE') {
    try {
      const id = req.query.id || (typeof req.body === 'object' && req.body?.id);
      if (!id) {
        return res.status(400).json({ error: 'Missing generation id' });
      }

      const result = await pool.query(
        'DELETE FROM generations WHERE id = $1 RETURNING blob_url',
        [id]
      );

      const deletedBlobUrl = result.rows[0]?.blob_url;
      const token = process.env.BLOB_READ_WRITE_TOKEN;
      if (deletedBlobUrl && token) {
        try {
          await del(deletedBlobUrl, { token });
        } catch (delErr) {
          console.warn('[blob-del] Failed to delete blob file:', delErr);
        }
      }

      return res.status(200).json({ success: true, deletedId: id });
    } catch (err: any) {
      console.error('[history-delete] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // POST: create a new generation history entry
  if (req.method === 'POST') {
    try {
      await pool.query(CREATE_TABLE);
      const { filename, blob_url, download_url, duration_text, script, script_excerpt } = req.body || {};
      if (!filename || !blob_url) {
        return res.status(400).json({ error: 'Missing filename or blob_url' });
      }
      const finalExcerpt = script_excerpt || (script ? script.slice(0, 500) : '');
      const result = await pool.query(
        'INSERT INTO generations (filename, blob_url, download_url, duration_text, script_excerpt, script) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [filename, blob_url, download_url || blob_url, duration_text || '', finalExcerpt, script || '']
      );
      return res.status(200).json({ success: true, id: result.rows[0]?.id });
    } catch (err: any) {
      console.error('[history-post] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // GET generations list
  if (req.method === 'GET') {
    try {
      await pool.query(CREATE_TABLE);

      const result = await pool.query(
        'SELECT id, created_at, filename, blob_url, download_url, duration_text, script_excerpt, script FROM generations ORDER BY created_at DESC LIMIT 50'
      );

      return res.status(200).json({
        items: result.rows,
        postgres_configured: true,
      });
    } catch (err: any) {
      console.error('[history-get] error:', err);
      return res.status(500).json({ error: err.message, items: [], postgres_configured: false });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}

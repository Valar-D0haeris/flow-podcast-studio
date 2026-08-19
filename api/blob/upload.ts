import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { Pool } from 'pg';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

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
    script_excerpt TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations (created_at DESC);
`;

async function ensureTable() {
  if (!pool) return;
  try {
    await pool.query(CREATE_TABLE);
  } catch (err) {
    console.error('[init-table] error:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-filename, x-duration, x-script-excerpt');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured in environment' });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    if (!body || body.length < 44) {
      return res.status(400).json({ error: 'Audio data is empty or corrupted' });
    }

    const rawFilename = (req.headers['x-filename'] as string) || `flow_podcast_${Date.now()}.wav`;
    const cleanFilename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
    const durationText = ((req.headers['x-duration'] as string) || '').slice(0, 30);
    const scriptExcerptB64 = (req.headers['x-script-excerpt'] as string) || '';
    
    let scriptExcerpt = '';
    try {
      scriptExcerpt = Buffer.from(scriptExcerptB64, 'base64').toString('utf8').slice(0, 500);
    } catch {}

    const blob = await put(cleanFilename, body, {
      access: 'public',
      token,
      contentType: 'audio/wav',
    });

    let dbId: number | null = null;
    if (pool) {
      try {
        await ensureTable();
        const result = await pool.query(
          'INSERT INTO generations (filename, blob_url, download_url, duration_text, script_excerpt) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [cleanFilename, blob.url, blob.downloadUrl, durationText, scriptExcerpt]
        );
        dbId = result.rows[0]?.id ?? null;
      } catch (dbErr) {
        console.error('[postgres] insert error (non-fatal):', dbErr);
      }
    }

    return res.status(200).json({
      success: true,
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      filename: cleanFilename,
      dbId,
    });
  } catch (err: any) {
    console.error('[upload-blob] error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

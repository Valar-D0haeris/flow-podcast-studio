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
  )
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN not configured' });
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);

    const filename = (req.headers['x-filename'] as string) || `flow_podcast_${Date.now()}.wav`;
    const durationText = (req.headers['x-duration'] as string) || '';
    const scriptExcerptB64 = (req.headers['x-script-excerpt'] as string) || '';
    let scriptExcerpt = '';
    try {
      scriptExcerpt = Buffer.from(scriptExcerptB64, 'base64').toString('utf8').slice(0, 500);
    } catch {}

    const blob = await put(filename, body, {
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
          [filename, blob.url, blob.downloadUrl, durationText, scriptExcerpt]
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
      filename,
      dbId,
    });
  } catch (err: any) {
    console.error('[upload-blob] error:', err);
    return res.status(500).json({ error: err.message || 'Upload failed' });
  }
}

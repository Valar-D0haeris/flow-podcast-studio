import type { VercelRequest, VercelResponse } from '@vercel/node';
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

const CREATE_JOBS_TABLE = `
  CREATE TABLE IF NOT EXISTS generation_jobs (
    id              TEXT PRIMARY KEY DEFAULT 'current_job',
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT NOT NULL,
    title           TEXT,
    current_chunk   INTEGER DEFAULT 0,
    total_chunks    INTEGER DEFAULT 0,
    percent         INTEGER DEFAULT 0,
    status_text     TEXT,
    blob_url        TEXT,
    error           TEXT
  );
`;

async function ensureJobsTable() {
  if (!pool) return;
  try {
    await pool.query(CREATE_JOBS_TABLE);
  } catch (err) {
    console.error('[init-jobs-table] error:', err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!pool) {
    return res.status(200).json({ job: null, sync_enabled: false });
  }

  try {
    await ensureJobsTable();

    // GET latest active job status
    if (req.method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM generation_jobs WHERE id = 'current_job'`
      );
      return res.status(200).json({
        job: result.rows[0] || null,
        sync_enabled: true
      });
    }

    // POST / UPDATE job status
    if (req.method === 'POST') {
      const {
        status = 'running',
        title = 'Flow Podcast',
        current_chunk = 0,
        total_chunks = 0,
        percent = 0,
        status_text = '',
        blob_url = null,
        error = null
      } = req.body || {};

      await pool.query(
        `INSERT INTO generation_jobs (id, updated_at, status, title, current_chunk, total_chunks, percent, status_text, blob_url, error)
         VALUES ('current_job', NOW(), $1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           updated_at = NOW(),
           status = EXCLUDED.status,
           title = EXCLUDED.title,
           current_chunk = EXCLUDED.current_chunk,
           total_chunks = EXCLUDED.total_chunks,
           percent = EXCLUDED.percent,
           status_text = EXCLUDED.status_text,
           blob_url = EXCLUDED.blob_url,
           error = EXCLUDED.error`,
        [status, title, current_chunk, total_chunks, percent, status_text, blob_url, error]
      );

      return res.status(200).json({ success: true });
    }

    // DELETE / Reset job
    if (req.method === 'DELETE') {
      await pool.query(`DELETE FROM generation_jobs WHERE id = 'current_job'`);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    console.error('[jobs] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

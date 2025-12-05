import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://ledger_user:ledger_password@localhost:5432/ledger_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const getClient = async (): Promise<PoolClient> => {
  return await pool.connect();
};

export const query = async (text: string, params?: unknown[]): Promise<unknown> => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
};

export const transaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export default pool;


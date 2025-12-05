import dotenv from 'dotenv';

// Use test database URL
dotenv.config({ path: '.env.test' });

// Set test database URL if not set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://ledger_user:ledger_password@localhost:5432/ledger_test';
}


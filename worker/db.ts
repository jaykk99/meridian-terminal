/** D1 schema bootstrap and small query helpers. */

export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  APP_ORIGIN?: string;
  /** Public Reown/WalletConnect project id used by the browser for QR pairing. */
  WALLETCONNECT_PROJECT_ID?: string;
};

let ready: Promise<void> | null = null;

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    github_id TEXT UNIQUE,
    login TEXT,
    name TEXT,
    avatar_url TEXT,
    wallet_address TEXT,
    is_guest INTEGER NOT NULL DEFAULT 0,
    balance REAL NOT NULL DEFAULT 100000,
    starting_balance REAL NOT NULL DEFAULT 100000,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address)`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    qty REAL NOT NULL,
    entry_price REAL NOT NULL,
    leverage REAL NOT NULL,
    margin REAL NOT NULL,
    notional REAL NOT NULL,
    tp REAL,
    sl REAL,
    status TEXT NOT NULL DEFAULT 'open',
    close_price REAL,
    realized_pnl REAL NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'manual',
    trader_id TEXT,
    trader_name TEXT,
    close_after INTEGER,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS idx_positions_user ON positions(user_id, status)`,
  `CREATE TABLE IF NOT EXISTS copies (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trader_id TEXT NOT NULL,
    allocation REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_sync INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_copies_user ON copies(user_id, status)`,
  `CREATE TABLE IF NOT EXISTS watchlist (
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, symbol)
  )`,
  `CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS wallet_challenges (
    address TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS token_balances (
    user_id TEXT PRIMARY KEY,
    amount REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS token_claims (
    user_id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS token_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    amount REAL NOT NULL,
    price REAL NOT NULL DEFAULT 0,
    usd REAL NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_token_ledger_kind ON token_ledger(kind, created_at)`,
];

async function init(env: Env): Promise<void> {
  // Databases created before wallet sign-in need the column added in place.
  try {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN wallet_address TEXT').run();
  } catch {
    /* column already exists */
  }
  await env.DB.batch(DDL.map((sql) => env.DB.prepare(sql)));
}

export function ensureSchema(env: Env): Promise<void> {
  if (!ready) {
    ready = init(env).catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export function newId(prefix = ''): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(36).padStart(2, '0');
  return prefix ? `${prefix}_${out}` : out;
}

export type UserRow = {
  id: string;
  github_id: string | null;
  login: string | null;
  name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  is_guest: number;
  balance: number;
  starting_balance: number;
  created_at: number;
};

export async function findUser(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

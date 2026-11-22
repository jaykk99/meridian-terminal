/** GitHub OAuth, guest sessions and cookie handling. */
import type { Context } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { verifyMessage } from 'viem';
import { ensureSchema, findUser, newId, type Env, type UserRow } from './db';

export const SESSION_COOKIE = 'meridian_session';
const STATE_COOKIE = 'meridian_oauth_state';
const SESSION_DAYS = 30;

export function originFor(c: Context<{ Bindings: Env }>): string {
  const configured = c.env.APP_ORIGIN?.replace(/\/$/, '');
  if (configured) return configured;
  return new URL(c.req.url).origin;
}

export function githubConfigured(env: Env): boolean {
  return Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
}

function secureCookie(c: Context<{ Bindings: Env }>): boolean {
  return originFor(c).startsWith('https://');
}

export async function startSession(c: Context<{ Bindings: Env }>, userId: string) {
  const id = newId('s');
  const now = Date.now();
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
  )
    .bind(id, userId, now, now + SESSION_DAYS * 86_400_000)
    .run();
  setCookie(c, SESSION_COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookie(c),
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function currentUser(c: Context<{ Bindings: Env }>): Promise<UserRow | null> {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return null;
  const session = await c.env.DB.prepare('SELECT * FROM sessions WHERE id = ?')
    .bind(sid)
    .first<{ id: string; user_id: string; expires_at: number }>();
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
    return null;
  }
  return findUser(c.env, session.user_id);
}

export async function requireUser(c: Context<{ Bindings: Env }>): Promise<UserRow | null> {
  await ensureSchema(c.env);
  return currentUser(c);
}

export async function createGuest(c: Context<{ Bindings: Env }>): Promise<UserRow> {
  const id = newId('u');
  const now = Date.now();
  const handle = `guest-${id.slice(-4)}`;
  await c.env.DB.prepare(
    `INSERT INTO users (id, github_id, login, name, avatar_url, is_guest, balance, starting_balance, created_at)
     VALUES (?, NULL, ?, ?, NULL, 1, 100000, 100000, ?)`,
  )
    .bind(id, handle, 'Guest Trader', now)
    .run();
  await startSession(c, id);
  const user = await findUser(c.env, id);
  if (!user) throw new Error('guest creation failed');
  return user;
}

export async function logout(c: Context<{ Bindings: Env }>) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
}

export async function githubAuthorize(c: Context<{ Bindings: Env }>) {
  const state = newId('st');
  setCookie(c, STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookie(c),
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID ?? '',
    redirect_uri: `${originFor(c)}/api/auth/github/callback`,
    scope: 'read:user user:email',
    state,
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(c: Context<{ Bindings: Env }>) {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: '/' });
  if (!code) return c.redirect('/?auth=error');
  if (!state || !expected || state !== expected) return c.redirect('/?auth=state');

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${originFor(c)}/api/auth/github/callback`,
    }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenJson.access_token) return c.redirect('/?auth=error');

  const profileRes = await fetch('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${tokenJson.access_token}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'meridian-terminal',
    },
  });
  if (!profileRes.ok) return c.redirect('/?auth=error');
  const profile = (await profileRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string | null;
  };

  const githubId = String(profile.id);
  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE github_id = ?')
    .bind(githubId)
    .first<UserRow>();

  let userId: string;
  if (existing) {
    userId = existing.id;
    await c.env.DB.prepare(
      'UPDATE users SET login = ?, name = ?, avatar_url = ?, is_guest = 0 WHERE id = ?',
    )
      .bind(profile.login, profile.name ?? profile.login, profile.avatar_url, userId)
      .run();
  } else {
    userId = newId('u');
    await c.env.DB.prepare(
      `INSERT INTO users (id, github_id, login, name, avatar_url, is_guest, balance, starting_balance, created_at)
       VALUES (?, ?, ?, ?, ?, 0, 100000, 100000, ?)`,
    )
      .bind(
        userId,
        githubId,
        profile.login,
        profile.name ?? profile.login,
        profile.avatar_url,
        Date.now(),
      )
      .run();
  }
  await startSession(c, userId);
  return c.redirect('/markets?welcome=1');
}

export function publicUser(user: UserRow) {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    isGuest: Boolean(user.is_guest),
    balance: user.balance,
    startingBalance: user.starting_balance,
    createdAt: user.created_at,
    walletAddress: user.wallet_address ?? null,
    provider: user.github_id
      ? ('github' as const)
      : user.wallet_address
        ? ('wallet' as const)
        : ('guest' as const),
  };
}

/* ---------------------------------------------------------- wallet sign-in */

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_RE = /^0x[a-fA-F0-9]{130}$/;
export const CHALLENGE_TTL_MS = 10 * 60_000;

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Build and persist a one-time message for the wallet to sign. The message is
 * stored server-side so the signature can only be used for this exact request.
 */
export async function walletChallenge(
  c: Context<{ Bindings: Env }>,
  rawAddress: string,
): Promise<{ error?: string; message?: string }> {
  const address = rawAddress.trim();
  if (!ADDRESS_RE.test(address)) return { error: 'That is not a valid wallet address.' };

  const nonce = newId('n').replace(/_/g, '').slice(0, 16);
  const host = new URL(originFor(c)).host;
  const message = [
    'Meridian wants you to sign in with your wallet:',
    address,
    '',
    `Domain: ${host}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
    '',
    'This signature proves you own this wallet. It costs no gas and cannot move funds.',
  ].join('\n');

  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO wallet_challenges (address, message, created_at, expires_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(address) DO UPDATE SET message = excluded.message, created_at = excluded.created_at, expires_at = excluded.expires_at`,
  )
    .bind(address.toLowerCase(), message, now, now + CHALLENGE_TTL_MS)
    .run();

  return { message };
}

/** Verify the signed message and open a wallet-backed session. */
export async function walletLogin(
  c: Context<{ Bindings: Env }>,
  rawAddress: string,
  signature: string,
): Promise<{ error?: string; user?: UserRow }> {
  const address = rawAddress.trim().toLowerCase();
  if (!ADDRESS_RE.test(address)) return { error: 'That is not a valid wallet address.' };
  if (!SIGNATURE_RE.test(signature.trim())) return { error: 'That signature is malformed.' };

  const challenge = await c.env.DB.prepare(
    'SELECT message, expires_at FROM wallet_challenges WHERE address = ?',
  )
    .bind(address)
    .first<{ message: string; expires_at: number }>();
  if (!challenge) return { error: 'Request a fresh sign-in message and try again.' };
  if (challenge.expires_at < Date.now()) {
    await c.env.DB.prepare('DELETE FROM wallet_challenges WHERE address = ?').bind(address).run();
    return { error: 'That sign-in message expired. Try again.' };
  }

  let valid = false;
  try {
    valid = await verifyMessage({
      address: address as `0x${string}`,
      message: challenge.message,
      signature: signature.trim() as `0x${string}`,
    });
  } catch {
    valid = false;
  }
  if (!valid) return { error: 'The signature did not match that wallet.' };

  // Single use: a signature cannot be replayed into another session.
  await c.env.DB.prepare('DELETE FROM wallet_challenges WHERE address = ?').bind(address).run();

  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE wallet_address = ?')
    .bind(address)
    .first<UserRow>();

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    userId = newId('u');
    await c.env.DB.prepare(
      `INSERT INTO users (id, github_id, login, name, avatar_url, wallet_address, is_guest, balance, starting_balance, created_at)
       VALUES (?, NULL, ?, ?, NULL, ?, 0, 100000, 100000, ?)`,
    )
      .bind(userId, address, shortAddress(address), address, Date.now())
      .run();
  }

  await startSession(c, userId);
  const user = await findUser(c.env, userId);
  if (!user) return { error: 'Could not open that account.' };
  return { user };
}

import { api } from './api';
import type { Me } from './types';

/** Minimal shape of the WalletConnect EIP-1193 provider we depend on. */
type PairingProvider = {
  connect(opts?: { chains?: number[] }): Promise<void>;
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: string, listener: (...args: unknown[]) => void): void;
  disconnect(): Promise<void>;
};

let active: PairingProvider | null = null;
let abortPairing: ((reason: Error) => void) | null = null;

const URI_TIMEOUT_MS = 20_000;
const APPROVAL_TIMEOUT_MS = 180_000;

export function trustWalletWalletConnectLink(uri: string): string {
  return `https://link.trustwallet.com/wc?uri=${encodeURIComponent(uri)}`;
}

export async function cancelWalletConnect(): Promise<void> {
  const reject = abortPairing;
  abortPairing = null;
  reject?.(new Error('cancelled'));
  const provider = active;
  active = null;
  if (provider) await provider.disconnect().catch(() => undefined);
}

function toHexMessage(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let hex = '0x';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Pair with Trust Wallet over WalletConnect, sign the server's one-time message
 * and exchange it for a Meridian session. The pairing is torn down afterwards.
 *
 * WalletConnect needs a Reown project id; without one this throws before any
 * network call, and the UI shows the setup note instead.
 */
export async function pairWithWalletConnect(
  projectId: string,
  handlers: { onUri: (uri: string) => void; onApproved?: () => void },
): Promise<Me> {
  const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
  await cancelWalletConnect();

  const provider = (await EthereumProvider.init({
    projectId,
    optionalChains: [1],
    showQrModal: false,
    metadata: {
      name: 'Meridian',
      description: 'AI-native paper trading terminal',
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.svg`],
    },
  })) as unknown as PairingProvider;

  active = provider;

  const cancelled = new Promise<never>((_, reject) => {
    abortPairing = reject;
  });
  const cancellation = cancelled.catch((err: Error) => {
    throw err;
  });

  let gotUri = false;
  let uriTimer: number | undefined;
  let approvalTimer: number | undefined;
  const cancelWith = (message: string) => abortPairing?.(new Error(message));

  uriTimer = window.setTimeout(() => {
    if (!gotUri) cancelWith('WalletConnect did not return a pairing code. Check the project id.');
  }, URI_TIMEOUT_MS);
  approvalTimer = window.setTimeout(() => {
    cancelWith('Pairing timed out. Generate a new code and try again.');
  }, APPROVAL_TIMEOUT_MS);

  provider.on('display_uri', (uri) => {
    gotUri = true;
    window.clearTimeout(uriTimer);
    handlers.onUri(String(uri));
  });

  try {
    await Promise.race([provider.connect(), cancellation]);
    handlers.onApproved?.();

    const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
    const address = accounts?.[0];
    if (!address) throw new Error('Trust Wallet did not return an account.');

    const { message } = await api.walletChallenge(address);
    const signature = (await provider.request({
      method: 'personal_sign',
      params: [toHexMessage(message), address],
    })) as string;

    if (typeof signature !== 'string' || !signature.startsWith('0x')) {
      throw new Error('The signature request was declined.');
    }

    const res = await api.walletLogin(address, signature);
    return res.user;
  } finally {
    window.clearTimeout(uriTimer);
    window.clearTimeout(approvalTimer);
    if (active === provider) active = null;
    abortPairing = null;
    await provider.disconnect().catch(() => undefined);
  }
}

import { api } from './api';
import type { Me } from './types';

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  isTrust?: boolean;
}

interface Eip6963Detail {
  info?: { rdns?: string; name?: string };
  provider?: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
    trustwallet?: { ethereum?: Eip1193Provider };
  }
}

export class WalletNotDetectedError extends Error {
  constructor() {
    super('Trust Wallet is not available in this browser.');
    this.name = 'WalletNotDetectedError';
  }
}

export function trustWalletLink(url = window.location.href): string {
  return `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`;
}

/**
 * Trust Wallet exposes an EIP-1193 provider inside its dApp browser and
 * extension. Newer builds announce themselves via EIP-6963, so check both.
 */
async function findTrustProvider(): Promise<Eip1193Provider | null> {
  const direct = window.trustwallet?.ethereum;
  if (direct) return direct;

  const announced = await new Promise<Eip1193Provider | null>((resolve) => {
    let settled = false;
    const finish = (provider: Eip1193Provider | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('eip6963:announceProvider', onAnnounce);
      resolve(provider);
    };
    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963Detail>).detail;
      if (detail?.info?.rdns === 'com.trustwallet.app' && detail.provider) {
        finish(detail.provider);
      }
    };
    window.addEventListener('eip6963:announceProvider', onAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    window.setTimeout(() => finish(null), 400);
  });
  if (announced) return announced;

  const injected = window.ethereum;
  if (injected?.isTrust) return injected;
  return null;
}

function toHexMessage(message: string): string {
  const bytes = new TextEncoder().encode(message);
  let hex = '0x';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}

/**
 * Connect Trust Wallet, sign the server's one-time message and exchange it for
 * a Meridian session. Throws WalletNotDetectedError when no provider is present.
 */
export async function connectTrustWallet(): Promise<Me> {
  const provider = await findTrustProvider();
  if (!provider) throw new WalletNotDetectedError();

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
}

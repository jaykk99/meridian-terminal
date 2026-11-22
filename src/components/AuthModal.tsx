import { useState } from 'react';
import { api, ApiError } from '../lib/api';
import type { Me } from '../lib/types';
import { Modal } from './ui';
import { GithubIcon, QrIcon, ShieldIcon, WalletIcon } from './Icons';
import { connectTrustWallet, trustWalletLink, WalletNotDetectedError } from '../lib/wallet';
import {
  cancelWalletConnect,
  pairWithWalletConnect,
  trustWalletWalletConnectLink,
} from '../lib/walletconnect';
import { qrDataUrl } from '../lib/qr';

type WalletConnectState =
  | { status: 'idle' }
  | { status: 'pairing'; uri?: string }
  | { status: 'signing' }
  | { status: 'error'; error: string };

export function AuthModal({
  open,
  onClose,
  onAuthed,
  githubConfigured,
  walletConnectProjectId,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onAuthed: (user: Me) => void;
  githubConfigured: boolean;
  walletConnectProjectId: string | null;
  reason?: string;
}) {
  const [busy, setBusy] = useState<null | 'wallet' | 'guest'>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletMissing, setWalletMissing] = useState(false);
  const [wc, setWc] = useState<WalletConnectState>({ status: 'idle' });
  const [copied, setCopied] = useState(false);

  const pairing = wc.status === 'pairing' || wc.status === 'signing';

  const close = () => {
    if (pairing) void cancelWalletConnect();
    setWc({ status: 'idle' });
    setCopied(false);
    onClose();
  };

  const guest = async () => {
    setBusy('guest');
    setError(null);
    try {
      const res = await api.guest();
      onAuthed(res.user);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start a guest session.');
    } finally {
      setBusy(null);
    }
  };

  const wallet = async () => {
    setBusy('wallet');
    setError(null);
    setWalletMissing(false);
    try {
      const user = await connectTrustWallet();
      onAuthed(user);
      onClose();
    } catch (err) {
      if (err instanceof WalletNotDetectedError) {
        setWalletMissing(true);
      } else {
        setError(
          err instanceof ApiError ? err.message : (err as Error).message || 'Wallet sign-in failed.',
        );
      }
    } finally {
      setBusy(null);
    }
  };

  const startWalletConnect = async () => {
    if (!walletConnectProjectId) {
      setWc({
        status: 'error',
        error:
          'Desktop QR pairing needs a WalletConnect (Reown) project id on the server. Set WALLETCONNECT_PROJECT_ID and reload — the id is public, not a secret.',
      });
      return;
    }
    setError(null);
    setWalletMissing(false);
    setWc({ status: 'pairing' });
    try {
      const user = await pairWithWalletConnect(walletConnectProjectId, {
        onUri: (uri) => setWc({ status: 'pairing', uri }),
        onApproved: () => setWc({ status: 'signing' }),
      });
      onAuthed(user);
      setWc({ status: 'idle' });
      onClose();
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'cancelled') {
        setWc({ status: 'idle' });
        return;
      }
      setWc({ status: 'error', error: message || 'WalletConnect pairing failed.' });
    }
  };

  const cancelPairing = () => {
    void cancelWalletConnect();
    setWc({ status: 'idle' });
    setCopied(false);
  };

  const copyUri = async () => {
    if (wc.status !== 'pairing' || !wc.uri) return;
    try {
      await navigator.clipboard.writeText(wc.uri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not access the clipboard — scan the QR code instead.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Open your terminal"
      subtitle={
        reason ??
        'Connect Trust Wallet — in-app, extension or QR — or use GitHub. Guest sessions live in this browser.'
      }
    >
      <div className="stack mt-6">
        <button
          className="btn wallet block"
          onClick={() => void wallet()}
          disabled={busy !== null || pairing}
          style={{ padding: '12px 16px', fontSize: 14 }}
        >
          {busy === 'wallet' ? <span className="spin" /> : <WalletIcon size={17} />}
          {busy === 'wallet' ? 'Waiting for Trust Wallet…' : 'Connect Trust Wallet'}
        </button>

        <button
          className="btn block"
          onClick={() => void startWalletConnect()}
          disabled={busy !== null || pairing}
          style={{ padding: '11px 16px', fontSize: 13.5 }}
        >
          <QrIcon size={16} />
          Scan QR with Trust Wallet
        </button>

        {!walletConnectProjectId && (
          <p className="tiny" style={{ margin: '-4px 0 0', color: 'var(--muted-2)', lineHeight: 1.5 }}>
            QR pairing needs a public WalletConnect (Reown) project id on the server.
          </p>
        )}

        {pairing && (
          <div className="qr-panel">
            {wc.status === 'pairing' && wc.uri && (
              <>
                <div className="qr-frame">
                  <img src={qrDataUrl(wc.uri)} width={208} height={208} alt="WalletConnect pairing QR code" />
                </div>
                <p className="tiny muted" style={{ margin: 0, textAlign: 'center', lineHeight: 1.55 }}>
                  Open Trust Wallet, tap the scanner in the top bar, and scan this code.
                </p>
                <div className="row" style={{ gap: 8 }}>
                  <a
                    className="btn wallet short"
                    style={{ flex: 1 }}
                    href={trustWalletWalletConnectLink(wc.uri)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <WalletIcon size={15} /> Open in Trust Wallet
                  </a>
                  <button className="btn ghost short" onClick={() => void copyUri()}>
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                </div>
              </>
            )}
            <div className="qr-wait">
              <span className="spin" />
              {wc.status === 'signing'
                ? 'Approve the signature request in Trust Wallet…'
                : wc.uri
                  ? 'Waiting for Trust Wallet to connect…'
                  : 'Preparing the pairing code…'}
            </div>
            <button className="btn ghost short" onClick={cancelPairing}>
              Cancel
            </button>
          </div>
        )}

        {wc.status === 'error' && <div className="notice">{wc.error}</div>}

        {walletMissing && (
          <div className="notice info">
            <b>Trust Wallet isn’t available in this browser.</b>
            <p style={{ margin: '6px 0 10px', lineHeight: 1.6 }}>
              Use the QR code above to pair from your phone, open this page inside Trust Wallet, or
              install the extension.
            </p>
            <div className="stack" style={{ gap: 8 }}>
              <a
                className="btn wallet block short"
                href={trustWalletLink()}
                target="_top"
                rel="noreferrer"
              >
                <WalletIcon size={15} /> Open in Trust Wallet
              </a>
              <a
                className="btn ghost block short"
                href="https://trustwallet.com/download"
                target="_blank"
                rel="noreferrer"
              >
                Get the Trust Wallet extension
              </a>
            </div>
          </div>
        )}

        <a
          className="btn block"
          href="/api/auth/github"
          style={{ padding: '12px 16px', fontSize: 14 }}
          onClick={(e) => {
            if (!githubConfigured) {
              e.preventDefault();
              setError(
                'GitHub sign-in is not configured on this deployment. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to enable it, or connect a wallet.',
              );
            }
          }}
        >
          <GithubIcon size={17} />
          Continue with GitHub
        </a>

        <button
          className="btn ghost block"
          onClick={guest}
          disabled={busy !== null || pairing}
          style={{ padding: '11px 16px', fontSize: 13.5 }}
        >
          {busy === 'guest' ? <span className="spin" /> : <ShieldIcon size={16} />}
          Continue as guest
        </button>

        {error && <div className="notice">{error}</div>}

        <p className="tiny" style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>
          Wallet sign-in verifies a signature over a one-time message. Meridian never sees your
          private keys or seed phrase and cannot move funds. Every account starts with{' '}
          <b style={{ color: 'var(--text)' }}>$100,000</b> of simulated capital — no deposits, no
          withdrawals.
        </p>

        {!githubConfigured && (
          <p className="tiny" style={{ color: 'var(--muted-2)', lineHeight: 1.6 }}>
            Operator note: GitHub OAuth needs a client ID and secret with the callback{' '}
            <span className="mono">{window.location.origin}/api/auth/github/callback</span>.
          </p>
        )}
      </div>
    </Modal>
  );
}

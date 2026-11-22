import { useCallback, useEffect, useState } from 'react';
import { api } from './lib/api';
import { navigate, usePathname, Link } from './lib/router';
import type { Me } from './lib/types';
import { Layout, Toast } from './components/Layout';
import { AuthModal } from './components/AuthModal';
import { Landing } from './pages/Landing';
import { Markets } from './pages/Markets';
import { Trade } from './pages/Trade';
import { Portfolio } from './pages/Portfolio';
import { CopyTrading } from './pages/Copy';
import { AiDesk } from './pages/Ai';
import { SumCool } from './pages/SumCool';

export default function App() {
  const path = usePathname();
  const [user, setUser] = useState<Me | null>(null);
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [walletConnectProjectId, setWalletConnectProjectId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>();
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);

  const notify = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    setToast({ message, kind });
  }, []);

  const refreshUser = useCallback(() => {
    api
      .me()
      .then((res) => {
        setUser(res.user);
        setGithubConfigured(res.githubConfigured);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refreshUser();
    api
      .config()
      .then((cfg) => setWalletConnectProjectId(cfg.walletConnectProjectId))
      .catch(() => undefined);
  }, [refreshUser]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('auth');
    const welcome = params.get('welcome');
    if (auth === 'error') {
      notify('GitHub sign-in failed. Check the OAuth app callback URL and try again.', 'error');
    } else if (auth === 'unconfigured') {
      setAuthReason(
        'GitHub sign-in is not configured on this deployment yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in the host settings, or continue as a guest.',
      );
      setAuthOpen(true);
    } else if (auth === 'state') {
      notify('That sign-in link expired. Please try again.', 'error');
    }
    if (welcome) notify('Signed in with GitHub. Welcome to Meridian.', 'success');
    if (auth || welcome) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requireAuth = useCallback((reason?: string) => {
    setAuthReason(reason);
    setAuthOpen(true);
  }, []);

  const onSignOut = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    setUser(null);
    notify('Signed out.', 'success');
    navigate('/');
  };

  const onStart = () => {
    if (user) navigate('/markets');
    else requireAuth();
  };

  const tradeMatch = path.match(/^\/trade\/([^/]+)/);
  const symbol = tradeMatch ? decodeURIComponent(tradeMatch[1]).toUpperCase() : null;

  let page = <Landing user={user} onStart={onStart} />;
  if (symbol) {
    page = (
      <Trade
        symbol={symbol}
        user={user}
        requireAuth={requireAuth}
        notify={notify}
        refreshUser={refreshUser}
      />
    );
  } else if (path.startsWith('/markets')) {
    page = <Markets user={user} requireAuth={requireAuth} />;
  } else if (path.startsWith('/portfolio')) {
    page = (
      <Portfolio
        user={user}
        requireAuth={requireAuth}
        notify={notify}
        refreshUser={refreshUser}
      />
    );
  } else if (path.startsWith('/copy')) {
    page = (
      <CopyTrading
        user={user}
        requireAuth={requireAuth}
        notify={notify}
        refreshUser={refreshUser}
      />
    );
  } else if (path.startsWith('/ai')) {
    page = <AiDesk />;
  } else if (path.startsWith('/sumcool')) {
    page = (
      <SumCool
        user={user}
        requireAuth={requireAuth}
        notify={notify}
        refreshUser={refreshUser}
      />
    );
  } else if (path !== '/') {
    page = (
      <div className="container">
        <div className="empty" style={{ paddingTop: 120 }}>
          <b>This page drifted off the tape</b>
          <p>The route you followed does not exist. The market board is still open.</p>
          <Link to="/markets" className="btn primary">
            Back to markets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout user={user} onSignIn={() => requireAuth()} onSignOut={() => void onSignOut()}>
        {page}
      </Layout>
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(next) => {
          setUser(next);
          refreshUser();
          notify('Signed in. Your terminal is ready.', 'success');
        }}
        githubConfigured={githubConfigured}
        walletConnectProjectId={walletConnectProjectId}
        reason={authReason}
      />
      {toast && <Toast message={toast.message} kind={toast.kind} />}
    </>
  );
}

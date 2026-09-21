import { useState, useEffect } from 'react';
import { Capture } from './components/Capture';
import { Login } from './components/Login';
import { Review } from './components/Review';
import { Samples } from './components/Samples';
import { Developer } from './components/Developer';
import { Warehouse } from './warehouse-ui';
import { SessionDevPill } from './components/SessionDevPill';
import { Key } from 'lucide-react';
import { GridDisplayProvider } from './context/GridDisplayContext';
import { VersionUpdateBadge } from './components/common/VersionUpdateBadge';
import { EcosystemStatusBadge } from './components/common/EcosystemStatusBadge';

export default function App() {
  const [view, setView] = useState<'capture' | 'review' | 'samples' | 'warehouse' | 'developer'>('capture');
  const [user, setUser] = useState<string | null>(() => localStorage.getItem('winzen_user'));

  useEffect(() => {
    if (user && view === 'capture') {
      const normalized = user.toLowerCase();
      if (normalized === 'jennifer') setView('review');
      else if (normalized === 'rhoda') setView('samples');
      else if (normalized === 'jason') setView('developer');
    }
  }, []);

  // Change password state globally
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const handleLogin = (username: string) => {
    localStorage.setItem('winzen_user', username);
    setUser(username);
    const normalized = username.toLowerCase();
    if (normalized === 'jennifer') {
      setView('review');
    } else if (normalized === 'rhoda') {
      setView('samples');
    } else if (normalized === 'jason') {
      setView('developer');
    } else {
      setView('capture');
    }
  };

  const handleChangePassword = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, newPassword: newPassword.trim() })
      });
      if (res.ok) {
        setPasswordMsg('Password changed successfully!');
        setNewPassword('');
        setTimeout(() => {
          setShowChangePassword(false);
          setPasswordMsg('');
        }, 2000);
      } else {
        setPasswordMsg('Failed to change password.');
      }
    } catch (err) {
      setPasswordMsg('Error changing password.');
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const isJason = user.toLowerCase() === 'jason';

  return (
    <GridDisplayProvider>
      <div className="min-h-screen bg-neutral-100 flex flex-col font-sans relative">
        <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Winzen Sample Library</h1>
          <nav className="flex gap-2 bg-neutral-100 p-1 rounded-lg">
            <button 
              onClick={() => setView('capture')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'capture' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Capture
            </button>
            <button 
              onClick={() => setView('review')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'review' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Review
            </button>
            <button 
              onClick={() => setView('samples')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'samples' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Library
            </button>
            <button 
              onClick={() => setView('warehouse')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${view === 'warehouse' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              Warehouse
            </button>
            {isJason && (
              <button 
                onClick={() => setView('developer')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${view === 'developer' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
              >
                Developer Mode
              </button>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-600 relative">
          <EcosystemStatusBadge />
          <VersionUpdateBadge />
          <a 
            href="/api/export-capture" 
            className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
            title="Download Capture station module for standalone development"
          >
            Export Capture Module
          </a>
          <a 
            href="/api/export-code" 
            className="px-3 py-1.5 bg-neutral-100 text-neutral-800 hover:bg-neutral-200 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
            title="Download entire application codebase"
          >
            Export Full App (.tar.gz)
          </a>
          
          <div className="flex items-center gap-3 border-l pl-4 border-neutral-300">
            <span className="font-bold text-neutral-900">{user}</span>
            <button 
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="p-1.5 hover:bg-neutral-100 rounded-md transition-colors text-neutral-500"
              title="Change Password"
            >
              <Key className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setUser(null); setView('capture'); }}
              className="text-neutral-400 hover:text-neutral-800 transition-colors ml-2"
            >
              Log out
            </button>
          </div>
          
          {showChangePassword && (
            <div className="absolute top-12 right-0 w-72 bg-white rounded-xl shadow-lg border border-neutral-200 p-5 z-50">
              <h3 className="font-bold text-neutral-900 mb-3">Change Password</h3>
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none text-sm"
                  placeholder="Enter new password"
                  required
                />
                {passwordMsg && (
                  <p className={`text-xs font-medium ${passwordMsg.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {passwordMsg}
                  </p>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button 
                    type="button" 
                    onClick={() => setShowChangePassword(false)}
                    className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-3 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg hover:bg-black"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {view === 'capture' && <Capture />}
        {view === 'review' && <Review />}
        {view === 'samples' && <Samples />}
        {view === 'warehouse' && <Warehouse userRole={user} />}
        {view === 'developer' && isJason && <Developer />}
      </main>
      <SessionDevPill />
    </div>
  </GridDisplayProvider>
);
}

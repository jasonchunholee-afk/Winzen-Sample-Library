const fs = require('fs');

// 1. Update Login.tsx to use real API
const loginCode = `import React, { useState } from 'react';

interface LoginProps {
  onLogin: (username: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        onLogin(data.username);
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      setError('Network error during login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white border border-neutral-200 rounded-xl shadow-sm p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Winzen Sample Library</h1>
          <p className="text-neutral-500 mt-2 text-sm">Please sign in to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-shadow"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-neutral-50 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-shadow"
              required
            />
          </div>
          
          {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-neutral-900 hover:bg-black text-white font-medium rounded-lg transition-colors mt-2 flex justify-center items-center"
          >
            {loading ? 'Authenticating...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/Login.tsx', loginCode);

// 2. Update App.tsx to include Developer mode and global Change Password
const appCode = `import { useState } from 'react';
import { Capture } from './components/Capture';
import { Login } from './components/Login';
import { Review } from './components/Review';
import { Samples } from './components/Samples';
import { Developer } from './components/Developer';
import { Key } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'capture' | 'review' | 'samples' | 'developer'>('capture');
  const [user, setUser] = useState<string | null>(null);

  // Change password state globally
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const handleLogin = (username: string) => {
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
    <div className="min-h-screen bg-neutral-100 flex flex-col font-sans relative">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Winzen Sample Library</h1>
          <nav className="flex gap-2 bg-neutral-100 p-1 rounded-lg">
            <button 
              onClick={() => setView('capture')}
              className={\`px-4 py-2 text-sm font-medium rounded-md transition-colors \${view === 'capture' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}\`}
            >
              Capture
            </button>
            <button 
              onClick={() => setView('review')}
              className={\`px-4 py-2 text-sm font-medium rounded-md transition-colors \${view === 'review' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}\`}
            >
              Review
            </button>
            <button 
              onClick={() => setView('samples')}
              className={\`px-4 py-2 text-sm font-medium rounded-md transition-colors \${view === 'samples' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}\`}
            >
              Library
            </button>
            {isJason && (
              <button 
                onClick={() => setView('developer')}
                className={\`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 \${view === 'developer' ? 'bg-neutral-900 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}\`}
              >
                Developer Mode
              </button>
            )}
          </nav>
        </div>
        
        <div className="flex items-center gap-4 text-sm font-medium text-neutral-600 relative">
          <a 
            href="/export.tar.gz" 
            download
            className="px-4 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors text-xs font-bold uppercase tracking-wider"
          >
            Export All (.tar.gz)
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
                  <p className={\`text-xs font-medium \${passwordMsg.includes('successfully') ? 'text-green-600' : 'text-red-600'}\`}>
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
        {view === 'developer' && isJason && <Developer />}
      </main>
    </div>
  );
}
`;
fs.writeFileSync('src/App.tsx', appCode);

// 3. Clean up Developer.tsx to remove internal auth logic entirely.
const developerCode = `import { useState, useEffect } from 'react';
import { Database, Download, RefreshCw } from 'lucide-react';

export function Developer() {
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/garments');
      const data = await res.json();
      setGarments(data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
            <Database className="w-6 h-6 text-neutral-700" />
            Developer Database Console
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">Direct access to the production SQLite database.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchData} className="px-4 py-2 border border-neutral-300 rounded-lg flex items-center gap-2 hover:bg-neutral-50 text-sm font-medium">
            <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
            Refresh
          </button>
          <a href="/library.db" download className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-medium">
            <Download className="w-4 h-4" />
            Download .sqlite
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Buyer</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Structural Feedback</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Summaries</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {garments.map(g => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-mono text-neutral-900 font-bold">{g.id}</td>
                  <td className="px-6 py-4">{g.buyer}</td>
                  <td className="px-6 py-4 text-neutral-500 max-w-[200px] truncate">{g.structural_feedback || '-'}</td>
                  <td className="px-6 py-4">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">
                      {g.summaries?.length || 0} Versions
                    </span>
                  </td>
                  <td className="px-6 py-4 text-neutral-400 font-mono text-xs">{g.created_at || 'Legacy JSON'}</td>
                </tr>
              ))}
              {garments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-neutral-400">
                    No data in the SQLite database yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`;
fs.writeFileSync('src/components/Developer.tsx', developerCode);

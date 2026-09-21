const fs = require('fs');

const code = `import { useState, useEffect } from 'react';
import { Database, Shield, Lock, Download, RefreshCw, Key } from 'lucide-react';

export function Developer() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const [garments, setGarments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  const handleLogin = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password: password.trim() })
      });
      
      if (res.ok) {
        setIsAuthenticated(true);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Network error during login');
    }
  };

  const handleChangePassword = async (e: import('react').FormEvent) => {
    e.preventDefault();
    setPasswordMsg('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), newPassword: newPassword.trim() })
      });
      if (res.ok) {
        setPasswordMsg('Password changed successfully!');
        setNewPassword('');
        setTimeout(() => setShowChangePassword(false), 2000);
      } else {
        setPasswordMsg('Failed to change password.');
      }
    } catch (err) {
      setPasswordMsg('Error changing password.');
    }
  };

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

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-neutral-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-neutral-200 max-w-sm w-full">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-neutral-900 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-center text-neutral-900 mb-6">Developer Console</h2>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none"
                placeholder="e.g. Jason"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none"
                placeholder="e.g. Jason"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
            
            <button type="submit" className="w-full py-3 bg-neutral-900 text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors">
              <Lock className="w-4 h-4" />
              Authenticate
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-neutral-700" />
            SQLite Explorer
          </h1>
          <p className="text-neutral-500 mt-2">Direct access to the production SQLite database.</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="px-4 py-2 border border-neutral-300 rounded-lg flex items-center gap-2 hover:bg-neutral-50 text-sm font-medium"
          >
            <Key className="w-4 h-4" />
            Change Password
          </button>
          <button onClick={fetchData} className="px-4 py-2 border border-neutral-300 rounded-lg flex items-center gap-2 hover:bg-neutral-50 text-sm font-medium">
            <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
            Refresh Data
          </button>
          <a href="/library.db" download className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 text-sm font-medium">
            <Download className="w-4 h-4" />
            Download .sqlite DB
          </a>
        </div>
      </div>

      {showChangePassword && (
        <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm max-w-md animate-in fade-in slide-in-from-top-4 duration-200">
          <h3 className="text-lg font-bold text-neutral-900 mb-4">Change Password</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">New Password</label>
              <input 
                type="text" 
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-neutral-900 outline-none"
                placeholder="Enter new password"
                required
              />
            </div>
            {passwordMsg && (
              <p className={\`text-sm font-medium \${passwordMsg.includes('successfully') ? 'text-green-600' : 'text-red-600'}\`}>
                {passwordMsg}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowChangePassword(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-black"
              >
                Save Password
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
              <tr>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Buyer</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Structural Feedback</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Summaries (Versions)</th>
                <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {garments.map(g => (
                <tr key={g.id} className="hover:bg-neutral-50">
                  <td className="px-6 py-4 font-mono text-neutral-900">{g.id}</td>
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

fs.writeFileSync('src/components/Developer.tsx', code);

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BotMessageSquare, Lock, User } from 'lucide-react';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('adminToken', data.token);
        onLogin();
        navigate('/dashboard');
      } else {
        setError(data.error);
        setLoading(false);
      }
    } catch {
      setError('Connection failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 font-sans relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-gradient-to-r from-indigo-500/10 to-transparent blur-3xl transform -skew-x-12 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-1/3 h-1/2 bg-blue-500/5 blur-3xl rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/30 mb-4">
            <BotMessageSquare size={32} className="text-white" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Admin Gateway</h2>
          <p className="text-slate-500 mt-2 font-medium">Log in to manage your AI instances</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 backdrop-blur-sm">
          {error && <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100 flex items-center justify-center">{error}</div>}
          
          <div className="mb-5 relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User size={18} />
              </div>
              <input 
                className="w-full rounded-xl border border-slate-200 pl-10 p-3 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" 
                type="text" 
                placeholder="Enter username" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <div className="mb-8 relative">
            <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input 
                className="w-full rounded-xl border border-slate-200 pl-10 p-3 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
          </div>
          
          <button 
            className="w-full rounded-xl bg-indigo-600 p-3.5 text-white font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] shadow-md shadow-indigo-600/20 disabled:opacity-70 disabled:active:scale-100" 
            type="submit"
            disabled={loading}
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

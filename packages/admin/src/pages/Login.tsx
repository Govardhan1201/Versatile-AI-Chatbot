import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
      }
    } catch {
      setError('Connection failed');
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="w-full max-w-sm rounded bg-white p-6 shadow-md border">
        <h2 className="mb-4 text-center text-2xl font-bold">Admin Login</h2>
        {error && <div className="mb-4 text-red-500 text-center">{error}</div>}
        <input className="mb-4 w-full rounded border p-2" type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input className="mb-6 w-full rounded border p-2" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button className="w-full rounded bg-blue-500 p-2 text-white hover:bg-blue-600" type="submit">Login</button>
      </form>
    </div>
  );
}

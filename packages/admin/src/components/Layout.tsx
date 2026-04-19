import { Outlet, Link } from 'react-router-dom';

export function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-slate-900 text-white p-6">
        <h1 className="text-xl font-bold mb-8">VERSATILE Bot</h1>
        <nav className="flex flex-col gap-2">
          <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded">Dashboard</Link>
          <Link to="/tenants" className="p-2 hover:bg-slate-800 rounded">Tenants</Link>
        </nav>
        <button onClick={onLogout} className="absolute bottom-6 p-2 text-slate-400 hover:text-white">Logout</button>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  );
}

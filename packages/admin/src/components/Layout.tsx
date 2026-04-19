import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Folders, LogOut, BotMessageSquare } from 'lucide-react';

export function Layout({ onLogout }: { onLogout: () => void }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-500 p-2 rounded-lg">
              <BotMessageSquare size={24} className="text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight">Vihara AI</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 flex flex-col gap-2">
          <Link 
            to="/dashboard" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/dashboard') 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </Link>
          <Link 
            to="/tenants" 
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive('/tenants') 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Folders size={20} />
            <span className="font-medium">Tenants</span>
          </Link>
        </nav>
        
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout} 
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-slate-400 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>
      
      <main className="flex-1 p-10 ml-0 bg-slate-50 h-screen overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

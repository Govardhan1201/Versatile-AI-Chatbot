import { useEffect, useState } from 'react';
import { Plus, X, Globe, Server, Activity } from 'lucide-react';

export function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [domains, setDomains] = useState('');

  const loadTenants = () => {
    fetch('/api/admin/tenants', {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    })
      .then(res => res.json())
      .then(setTenants)
      .catch(console.error);
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          siteId: siteId.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          siteName,
          allowedDomains: domains.split(',').map(d => d.trim()).filter(Boolean) || ['*'],
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setSiteId('');
        setSiteName('');
        setDomains('');
        loadTenants();
      } else {
        const err = await res.json();
        alert('Failed to create: ' + err.error);
      }
    } catch (err) {
      alert('Network Error');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto pb-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Active Tenants</h2>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-[0.98] shadow-md shadow-indigo-600/20"
        >
          <Plus size={20} />
          Create Tenant
        </button>
      </div>
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-xs tracking-wider">
            <tr>
              <th className="p-5">Site Configuration</th>
              <th className="p-5">Allowed Domains</th>
              <th className="p-5">Status</th>
              <th className="p-5 text-right flex-1 min-w-48 text-transparent">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants.map(t => (
              <tr key={t.siteId} className="hover:bg-slate-50 transition-colors group">
                <td className="p-5">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2.5 rounded-xl shadow-sm border border-indigo-100">
                      <Server size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 leading-tight">{t.siteName}</div>
                      <div className="text-sm font-mono text-slate-400 mt-1">{t.siteId}</div>
                    </div>
                  </div>
                </td>
                <td className="p-5">
                  <div className="flex items-center gap-2 text-slate-600 text-sm">
                    <Globe size={14} className="text-slate-400" />
                    {t.allowedDomains.join(', ')}
                  </div>
                </td>
                <td className="p-5">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${t.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {t.active ? <Activity size={12} /> : null}
                    {t.active ? 'Online' : 'Disabled'}
                  </span>
                </td>
                <td className="p-5 text-right">
                  <button className="text-indigo-600 font-semibold text-sm hover:text-indigo-800 transition-colors invisible group-hover:visible">Configure Space →</button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={4} className="p-10 text-center text-slate-500 italic">No tenants provisioned. Click Create Tenant to begin.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Tenant Modal Overlap */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm shadow-2xl z-50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-extrabold text-slate-900">Provision New Tenant</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition-colors p-2 hover:bg-slate-100 rounded-full">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddTenant}>
              <div className="mb-5">
                <label className="block text-sm font-bold text-slate-700 mb-2">Display Name</label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  placeholder="e.g. Vihara Retreat"
                  value={siteName} 
                  onChange={e => setSiteName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                />
              </div>

              <div className="mb-5">
                <label className="block text-sm font-bold text-slate-700 mb-2">Internal Site ID <span className="text-slate-400 font-normal">(slug configuration)</span></label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. vihara"
                  value={siteId} 
                  onChange={e => setSiteId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 font-mono text-sm text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-slate-700 mb-2">Allowed Domains <span className="text-slate-400 font-normal">(comma separated)</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. localhost, mydomain.com"
                  value={domains} 
                  onChange={e => setDomains(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-3 text-slate-900 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                />
                <p className="text-xs text-slate-500 mt-2 font-medium">Leave blank or use `*` to allow all domains.</p>
              </div>

              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 px-4 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1 py-3.5 px-4 font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-md shadow-indigo-600/20 rounded-xl transition-all disabled:opacity-70 disabled:active:scale-100"
                >
                  {loading ? 'Provisioning...' : 'Create Tenant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

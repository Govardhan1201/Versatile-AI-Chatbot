import { useEffect, useState } from 'react';

export function Tenants() {
  const [tenants, setTenants] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/tenants', {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    })
      .then(res => res.json())
      .then(setTenants)
      .catch(console.error);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Tenants</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Add Tenant</button>
      </div>
      
      <div className="bg-white rounded shadow border">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4">Site ID</th>
              <th className="p-4">Name</th>
              <th className="p-4">Domains</th>
              <th className="p-4">Status</th>
              <th className="p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.siteId} className="border-b">
                <td className="p-4 font-mono text-sm">{t.siteId}</td>
                <td className="p-4">{t.siteName}</td>
                <td className="p-4">{t.allowedDomains.join(', ')}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${t.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {t.active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-blue-600 hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

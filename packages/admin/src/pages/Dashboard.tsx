import { useEffect, useState } from 'react';

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/analytics/vihara', {
      headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }
    })
      .then(res => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) return <p className="p-8 text-gray-500">Loading stats...</p>;

  // Helpers for tailwind max-width bars
  const maxLangCount = Math.max(...Object.values(stats.languageBreakdown || {}).map(Number), 1);
  const maxToolCount = Math.max(...Object.values(stats.toolUsage || {}).map(Number), 1);

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <h2 className="text-3xl font-bold mb-6 text-slate-800">Analytics Overview (VIHARA)</h2>
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard title="Total Chats" value={stats.totalChats} />
        <MetricCard title="Total Messages" value={stats.totalMessages} />
        <MetricCard title="Voice Interactions" value={stats.voiceUsage} />
        <MetricCard title="Knowledge Misses" value={stats.failedQueries} color="text-red-500" />
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Top Questions */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold mb-4 border-b pb-2">Top Questions</h3>
          <ul className="space-y-3">
            {(stats.topQuestions || []).map((q: any, i: number) => (
              <li key={i} className="flex justify-between items-center text-sm">
                <span className="truncate pr-4">{q.question}</span>
                <span className="bg-slate-100 px-3 py-1 rounded-full font-medium text-slate-600">{q.count}</span>
              </li>
            ))}
            {(!stats.topQuestions || stats.topQuestions.length === 0) && <p className="text-gray-400 italic">No queries logged yet.</p>}
          </ul>
        </div>

        <div className="space-y-8">
          {/* Tool Usage Bars */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Tool Execution Metrics</h3>
            <div className="space-y-4">
              {Object.entries(stats.toolUsage || {}).map(([tool, count]: any) => (
                <div key={tool}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{tool}</span>
                    <span>{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${(count / maxToolCount) * 100}%` }}></div>
                  </div>
                </div>
              ))}
              {Object.keys(stats.toolUsage || {}).length === 0 && <p className="text-gray-400 italic">No tools executed yet.</p>}
            </div>
          </div>

          {/* Language Breakdown Bars */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold mb-4 border-b pb-2">Language Breakdown</h3>
            <div className="space-y-4">
              {Object.entries(stats.languageBreakdown || {}).map(([lang, count]: any) => (
                <div key={lang}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{lang.toUpperCase()}</span>
                    <span>{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(count / maxLangCount) * 100}%` }}></div>
                  </div>
                </div>
              ))}
              {Object.keys(stats.languageBreakdown || {}).length === 0 && <p className="text-gray-400 italic">No language data yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, color = "text-slate-800" }: { title: string, value: number, color?: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
      <h3 className="text-sm font-medium text-slate-500 mb-2 uppercase tracking-wider">{title}</h3>
      <div className={`text-4xl font-bold ${color}`}>{value || 0}</div>
    </div>
  );
}

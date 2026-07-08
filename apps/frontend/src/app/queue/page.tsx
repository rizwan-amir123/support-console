'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchEscalations } from '../../lib/api';
import { AgentAction } from '../../types';
import Link from 'next/link';

export default function QueuePage() {
  const [escalations, setEscalations] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wrapped in useCallback so it can be called reliably by both useEffect and the manual button
  const loadQueue = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const data = await fetchEscalations();
      setEscalations(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch only once on component mount
  useEffect(() => {
    loadQueue(true);
  }, [loadQueue]);

  if (loading && escalations.length === 0) {
    return <div className="text-xs font-mono text-slate-500">Awaiting container stream...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header section with responsive layout adjustment for the button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold font-mono tracking-tight">Escalation Triage Queue</h2>
          <p className="text-xs text-slate-400">Review pending automated mutations flagged by safety guardrails.</p>
        </div>
        
        {/* Manual Refresh Button */}
        <button
          onClick={() => loadQueue(false)}
          disabled={refreshing}
          className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 font-mono text-xs font-bold rounded transition border border-slate-700 shadow-sm"
        >
          {refreshing ? '⟳ Refreshing...' : '↻ Refresh Queue'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 text-rose-200 text-xs font-mono rounded">
          ⚠️ Connection Fault: {error}
        </div>
      )}

      {escalations.length === 0 ? (
        <div className="border border-dashed border-slate-800 rounded-lg p-12 text-center">
          <p className="text-sm text-slate-500">Queue completely clear. Operational baseline normal.</p>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
          {/* Responsive Layout: Table for desktop, block list for mobile */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400 text-[11px] uppercase tracking-wider font-mono">
                  <th className="p-4">Target Order</th>
                  <th className="p-4">Requested Intent</th>
                  <th className="p-4">AI Reason Fragment</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-xs font-mono">
                {escalations.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/30 transition">
                    <td className="p-4 font-bold text-emerald-400">
                      {item.proposed_data.orderId || 'UNKN_REF'}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.action_type === 'refund' ? 'bg-amber-950 text-amber-400 border border-amber-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                      }`}>
                        {item.action_type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-300 max-w-xs truncate">
                      {item.agent_reasoning}
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        href={`/escalations/${item.id}`}
                        className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-100 px-3 py-1.5 rounded transition font-bold text-[11px]"
                      >
                        Inspect →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Fallback layout for smaller/mobile devices */}
          <div className="block md:hidden divide-y divide-slate-800">
            {escalations.map((item) => (
              <div key={item.id} className="p-4 space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-emerald-400">{item.proposed_data.orderId || 'UNKN_REF'}</span>
                  <span className="text-[10px] uppercase text-slate-400">{item.action_type}</span>
                </div>
                <p className="text-slate-300 text-[11px] line-clamp-2 bg-slate-900/40 p-2 rounded">
                  {item.agent_reasoning}
                </p>
                <Link 
                  href={`/escalations/${item.id}`}
                  className="block text-center bg-slate-800 hover:bg-slate-700 p-2 rounded font-bold text-[11px]"
                >
                  Inspect Context
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

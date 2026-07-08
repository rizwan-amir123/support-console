'use client';

import { useEffect, useState } from 'react';
import { fetchAllOrders } from '../../lib/api';
import Link from 'next/link';

export default function OrdersRegistryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      try {
        const data = await fetchAllOrders();
        setOrders(data);
      } catch (err: any) {
        setError(err.message || 'Failed to pull order tables.');
      } finally {
        setLoading(false);
      }
    }
    loadOrders();
  }, []);

  if (loading) return <div className="text-xs font-mono text-slate-500 p-6">Streaming orders ledger data...</div>;
  if (error) return <div className="m-6 p-4 bg-rose-950 text-rose-200 text-xs font-mono border border-rose-800 rounded">⚠️ Error: {error}</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4 md:p-6 font-mono">
      {/* Header Matrix Block */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">System Orders Ledger</h1>
          <p className="text-xs text-slate-500 mt-1">Cross-workspace immutable telemetry & refund guardrail verification</p>
        </div>
        <Link href="/queue" className="text-xs bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-300 hover:text-emerald-400 px-3 py-2 rounded transition text-center">
          ← Operational Triage Queue
        </Link>
      </div>

      {/* Responsive Data Container */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                <th className="p-4 font-bold">Order Number</th>
                <th className="p-4 font-bold">Fulfillment Status</th>
                <th className="p-4 font-bold text-right">Total Financials</th>
                <th className="p-4 font-bold text-right">Refunded Delta</th>
                <th className="p-4 font-bold text-center">Cap Lock</th>
                <th className="p-4 font-bold hidden md:table-cell">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 text-slate-300">
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 italic">No transactional logs present inside database cluster.</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-900/40 transition">
                    {/* Identifier */}
                    <td className="p-4 font-bold text-slate-200">
                      {order.order_number}
                    </td>
                    {/* Status Badge */}
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        order.status === 'delivered' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40' :
                        order.status === 'cancelled' ? 'bg-rose-950/60 text-rose-400 border-rose-800/40' :
                        'bg-amber-950/60 text-amber-400 border-amber-800/40'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    {/* Total Value */}
                    <td className="p-4 text-right font-semibold text-slate-100">
                      {Number(order.total_amount).toFixed(2)} {order.currency}
                    </td>
                    {/* Refunded Tracking */}
                    <td className="p-4 text-right text-amber-400 font-semibold">
                      ${Number(order.refunded_amount || 0).toFixed(2)}
                    </td>
                    {/* Fully Refunded Checker */}
                    <td className="p-4 text-center">
                      <span className={`text-base ${order.is_fully_refunded ? 'text-rose-500' : 'text-slate-700'}`}>
                        {order.is_fully_refunded ? '🔒' : '🔓'}
                      </span>
                    </td>
                    {/* Creation Timestamp */}
                    <td className="p-4 hidden md:table-cell text-slate-500 text-[11px]">
                      {new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

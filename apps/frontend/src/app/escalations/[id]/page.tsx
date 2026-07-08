// apps/frontend/src/app/escalations/[id]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import { fetchEscalationById, approveAction, rejectAction } from '../../../lib/api';
import { AgentAction } from '../../../types';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EscalationReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const [action, setAction] = useState<AgentAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hardcode a static reviewer UUID for local review testing simulation
  const REVIEWER_ID = 'b18274cf-e421-432a-bc91-ff183490192d';

  useEffect(() => {
    async function loadActionContext() {
      try {
        const data = await fetchEscalationById(id);
        setAction(data);
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve details.');
      } finally {
        setLoading(false);
      }
    }
    loadActionContext();
  }, [id]);

  const handleApproval = async () => {
    if (!action) return;
    setSubmitting(true);
    setError(null);

    try {
      await approveAction(action.id, REVIEWER_ID);
      setSuccessMessage('Action authorized successfully. System state synchronized.');
      setAction((prev) => prev ? { ...prev, status: 'approved' } : null);
    } catch (err: any) {
      // HONEST CONCURRENT STATE TRIGGER: 
      // Catches state or version mismatch from NestJS backend if already updated
      setError(`Concurrent Execution Blocked: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejection = async () => {
    if (!action) return;
    setSubmitting(true);
    setError(null);

    try {
      await rejectAction(action.id, REVIEWER_ID);
      setSuccessMessage('Action rejected. Escalation token moved to cold status.');
      setAction((prev) => prev ? { ...prev, status: 'rejected' } : null);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rejection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-xs font-mono text-slate-500">Retrieving trace relational data...</div>;
  if (!action && error) return <div className="p-4 bg-rose-950 text-rose-200 text-xs font-mono border border-rose-800 rounded">⚠️ Fatal: {error}</div>;
  if (!action) return <div className="text-xs font-mono text-slate-500">Action node missing.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Upper Navigation Anchor */}
      <div>
        <Link href="/queue" className="text-xs font-mono text-slate-400 hover:text-emerald-400 transition">
          ← Return to Triage Queue
        </Link>
      </div>

      {/* Primary Alerts Banner */}
      {error && (
        <div className="p-4 bg-rose-950/80 border border-rose-700 text-rose-100 text-xs font-mono rounded space-y-1">
          <p className="font-bold">❌ STATE OUT OF SYNC</p>
          <p>{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-700 text-emerald-100 text-xs font-mono rounded">
          ✨ Success: {successMessage}
        </div>
      )}

      {/* Main Container Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Context Logs and AI Loop Audit Data */}
        <div className="md:col-span-2 space-y-6">
          {/* Section: Original Raw Request */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
            <h3 className="text-xs font-bold uppercase text-slate-400 border-b border-slate-800 pb-2 mb-3">
              1. Raw Customer Content Context
            </h3>
            <p className="text-sm text-slate-200 bg-slate-900/50 p-3 rounded border border-slate-800/60 leading-relaxed italic">
              "{action.support_requests?.customer_message || 'No direct customer input found.'}"
            </p>
          </div>

          {/* Section: LLM Step Traces & Logs */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
            <h3 className="text-xs font-bold uppercase text-slate-400 border-b border-slate-800 pb-2 mb-3">
              2. Agent Reasoning Execution Trace
            </h3>
            <div className="text-xs text-slate-300 bg-slate-900/40 p-4 rounded border border-slate-800 space-y-2 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-mono">
              {action.agent_reasoning}
            </div>
          </div>
        </div>

        {/* Column 3: The Action Execution Dock */}
        <div className="space-y-6">
          <div className="bg-slate-950 border border-emerald-800/40 rounded-lg p-4 font-mono space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400 border-b border-slate-800 pb-2">
              3. Guarded Mutation Dock
            </h3>

            {/* Target Specs Meta Row */}
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-slate-500 block uppercase text-[10px]">Target Identifier</span>
                <span className="font-bold text-slate-200 text-sm">{action.proposed_data.orderId}</span>
              </div>
              <div>
                <span className="text-slate-500 block uppercase text-[10px]">Action Classification</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-400 border border-amber-800 inline-block mt-0.5">
                  {action.action_type}
                </span>
              </div>
              {action.proposed_data.amount && (
                <div>
                  <span className="text-slate-500 block uppercase text-[10px]">Calculated Refund Total</span>
                  <span className="font-bold text-amber-400 text-lg">${Number(action.proposed_data.amount).toFixed(2)}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500 block uppercase text-[10px]">Token Live Status</span>
                <span className={`font-bold ${action.status === 'proposed' ? 'text-amber-500 animate-pulse' : action.status === 'approved' ? 'text-emerald-400' : 'text-slate-500'}`}>
                  ● {action.status.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Active Control Toggles */}
            {action.status === 'proposed' && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={handleApproval}
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 text-xs font-bold py-2.5 rounded transition uppercase tracking-wider"
                >
                  {submitting ? 'Executing Locks...' : 'Authorize Action'}
                </button>
                <button
                  onClick={handleRejection}
                  disabled={submitting}
                  className="w-full bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800 text-slate-200 text-xs font-bold py-2 rounded transition uppercase tracking-wider"
                >
                  Reject Proposal
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

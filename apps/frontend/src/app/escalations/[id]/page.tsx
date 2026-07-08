'use client';

import { useEffect, useState, use } from 'react';
import { fetchEscalationById, approveAction, rejectAction, fetchAuditLogs } from '../../../lib/api';
import { AgentAction, AuditLog } from '../../../types';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EscalationReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const [action, setAction] = useState<AgentAction | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]); // 👈 Track audit history data stream
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Hardcode a static reviewer UUID for local review testing simulation
  const REVIEWER_ID = 'b18274cf-e421-432a-bc91-ff183490192d';

  useEffect(() => {
		async function loadActionContext() {
		  try {
		    // 1. Fetch the escalation action details first
		    const actionData = await fetchEscalationById(id);
		    setAction(actionData);

		    // 2. Safely grab the support request ID to fetch its audit trail
		    if (actionData?.support_request_id) {
		      const logsData = await fetchAuditLogs(actionData.support_request_id);
		      setLogs(logsData);
		    }
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
      setAction((prev) => (prev ? { ...prev, status: 'approved' } : null));
      
      // Refresh timeline records cleanly following an application mutation
      const updatedLogs = await fetchAuditLogs(id);
      setLogs(updatedLogs);
    } catch (err: any) {
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
      setAction((prev) => (prev ? { ...prev, status: 'rejected' } : null));
      
      const updatedLogs = await fetchAuditLogs(id);
      setLogs(updatedLogs);
    } catch (err: any) {
      setError(err.message || 'Failed to submit rejection.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-xs font-mono text-slate-500 p-6">Retrieving trace relational data...</div>;
  if (!action && error) return <div className="m-6 p-4 bg-rose-950 text-rose-200 text-xs font-mono border border-rose-800 rounded">⚠️ Fatal: {error}</div>;
  if (!action) return <div className="text-xs font-mono text-slate-500 p-6">Action node missing.</div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-4 md:p-6">
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

          {/* 👇 Section: Live Audit History Timeline (NEW) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono">
            <h3 className="text-xs font-bold uppercase text-slate-400 border-b border-slate-800 pb-2 mb-4">
              3. System Action Audit Trail
            </h3>
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No historical traces registered against this target.</p>
            ) : (
              <div className="flow-root pl-2">
                <ul className="-mb-8">
                  {logs.map((log, logIdx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {logIdx !== logs.length - 1 && (
                          <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800" aria-hidden="true" />
                        )}
                        <div className="relative flex space-x-3 items-start">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-slate-950 text-xs ${
                              log.actor_type === 'agent' 
                                ? 'bg-indigo-500/20 text-indigo-400' 
                                : log.actor_type === 'human'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-500/20 text-slate-400'
                            }`}>
                              {log.actor_type === 'agent' ? '🤖' : log.actor_type === 'human' ? '👤' : '⚙️'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                            <div>
                              <p className="text-xs text-slate-300 font-bold">
                                {log.action}{' '}
                                <span className="text-[10px] text-slate-500 font-normal capitalize">via {log.actor_type}</span>
                              </p>
                              {log.metadata && Object.keys(log.metadata).length > 0 && (
                                <p className="text-[11px] text-slate-400 mt-1 bg-slate-900/60 p-2 rounded border border-slate-800/80 font-mono break-all max-h-32 overflow-y-auto">
                                  {JSON.stringify(log.metadata)}
                                </p>
                              )}
                            </div>
                            <div className="text-right text-[10px] text-slate-500 whitespace-nowrap self-start">
                              {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: The Action Execution Dock */}
        <div className="space-y-6">
          <div className="bg-slate-950 border border-emerald-800/40 rounded-lg p-4 font-mono space-y-4">
            <h3 className="text-xs font-bold uppercase text-emerald-400 border-b border-slate-800 pb-2">
              4. Guarded Mutation Dock
            </h3>

            {/* Target Specs Meta Row */}
            <div className="space-y-3 text-xs">
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

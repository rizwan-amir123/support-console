// apps/frontend/src/lib/api.ts
import { AgentAction } from '../types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function fetchEscalations(): Promise<AgentAction[]> {
  const res = await fetch(`${BASE_URL}/escalations`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch the escalation queue.');
  return res.json();
}

export async function fetchEscalationById(id: string): Promise<AgentAction> {
  const res = await fetch(`${BASE_URL}/escalations/${id}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to retrieve specific escalation context.');
  return res.json();
}

export async function approveAction(actionId: string, reviewerId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/escalations/${actionId}/approve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewerId }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || 'Action modification rejected.');
  }
}

export async function rejectAction(actionId: string, reviewerId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/escalations/${actionId}/reject`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewerId }),
  });

  if (!res.ok) {
    throw new Error('Failed to reject action item state.');
  }
}

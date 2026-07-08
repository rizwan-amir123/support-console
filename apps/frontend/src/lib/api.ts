// apps/frontend/src/lib/api.ts
import { AgentAction, OrderEntity, AuditLog} from '../types';

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

export async function fetchAuditLogs(escalationId: string): Promise<AuditLog[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/escalations/${escalationId}/logs`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to retrieve audit log trail.');
  return res.json();
}

export async function fetchAllOrders(): Promise<OrderEntity[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
    cache: 'no-store', // Always get fresh financial metrics
  });
  
  if (!res.ok) {
    throw new Error('Failed to retrieve system order telemetry.');
  }
  
  return res.json() as Promise<OrderEntity[]>;
}

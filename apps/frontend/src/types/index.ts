export type TicketStatus = 'processing' | 'resolved' | 'escalated';
export type ActionStatus = 'proposed' | 'approved' | 'rejected';
export type ActionType = 'refund' | 'cancellation';

export interface SupportRequest {
  id: string;
  customer_message: string;
  status: TicketStatus;
  order_id: string | null;
  created_at: string;
}

export interface AgentAction {
  id: string;
  support_request_id: string;
  action_type: ActionType;
  status: ActionStatus;
  agent_reasoning: string;
  proposed_data: {
    orderId: string;
    amount?: number;
    reason?: string;
  };
  tool_calls: any[];
  created_at: string;
  support_requests?: SupportRequest; // Joined from relation
}

export interface AuditLog {
  id: string;
  actor_type: 'agent' | 'human';
  action: string;
  target_id: string;
  metadata: any;
  created_at: string;
}

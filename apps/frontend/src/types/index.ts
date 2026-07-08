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
  support_requests?: SupportRequest; 
}

export interface AuditLog {
  id: string;
  actor_type: 'agent' | 'human' | 'system';
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface OrderEntity {
  id: string;
  order_number: string;
  customer_id: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  version: number;
  refunded_amount: number;
  is_fully_refunded: boolean;
}

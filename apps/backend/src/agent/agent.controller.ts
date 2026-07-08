// src/agent/agent.controller.ts
import { Controller, Post, Body, Param, Patch, BadRequestException, Get, Inject } from '@nestjs/common';
import { AgentService } from './agent.service';
import { SupabaseClient } from '@supabase/supabase-js';

@Controller('api')
export class AgentController {
  constructor(
    @Inject(AgentService) private readonly agentService: AgentService,       
    @Inject(SupabaseClient) private readonly supabase: SupabaseClient,
  ) {}

  @Post('agent/process')
  async processSupportRequest(@Body() body: { message: string; orderId?: string }) {
    if (!body.message) throw new BadRequestException('Message parameter required');
    return await this.agentService.runAgentLoop(body.message, body.orderId);
  }

  @Get('escalations')
  async getEscalations() {
    // Return all items pending human assessment for Queue View
    const { data, error } = await this.supabase
      .from('agent_actions')
      .select(`
        id, action_type, status, agent_reasoning, created_at, proposed_data,
        support_requests ( id, customer_message, status )
      `)
      .eq('status', 'proposed')
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  @Get('escalations/:id')
  async getEscalation(@Param('id') id: string) {
    const { data, error } = await this.supabase
      .from('agent_actions')
      .select(`
        id,
        support_request_id,
        action_type,
        status,
        agent_reasoning,
        proposed_data,
        tool_calls,
        created_at,
        support_requests (
          id,
          customer_message,
          status,
          order_id,
          created_at
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) throw new BadRequestException('Escalation record not found');
    return data;
  }

  @Patch('escalations/:id/approve')
  async approveAction(
    @Param('id') id: string, 
    @Body() body: { reviewerId: string }
  ) {
    if (!body.reviewerId) throw new BadRequestException('reviewerId tracking token is required');

    // 1. Fetch action metadata atomically
    const { data: action, error: actionErr } = await this.supabase
      .from('agent_actions')
      .select('*')
      .eq('id', id)
      .single();

    if (actionErr || !action) throw new BadRequestException('Escalation row not resolved.');
    if (action.status !== 'proposed') {
      throw new BadRequestException('Honest Concurrent Block: Action processed already by another supervisor.');
    }

    const { orderId, amount } = action.proposed_data; // This orderId is a string like "ORD-1043"

    // 2. Extract current targeted entity state using order_number instead of UUID id
    const { data: order, error: orderErr } = await this.supabase
      .from('orders')
      .select('id, order_number, total_amount, refunded_amount, status, version')
      .eq('order_number', orderId) // 👈 FIXED: Querying by string format code
      .single();

    if (orderErr || !order) throw new BadRequestException('Target order was not found.');

    // 3. Re-verify guardrails just in case mutations altered conditions since the agent evaluated it
    if (action.action_type === 'refund') {
      const targetRefundTotal = Number(order.refunded_amount || 0) + Number(amount);
      if (targetRefundTotal > Number(order.total_amount)) {
        throw new BadRequestException('Guardrail Exception: This calculation breaks order limits.');
      }

      // 4. ATOMIC UPDATE utilizing optimistic validation state check on the exact UUID
      const { data: updatedOrder, error: updateErr } = await this.supabase
        .from('orders')
        .update({
          refunded_amount: targetRefundTotal,
          is_fully_refunded: targetRefundTotal === Number(order.total_amount),
          version: order.version + 1
        })
        .eq('id', order.id) // 👈 FIXED: Using the actual UUID retrieved from the step 2 selection query
        .eq('version', order.version) // Match target state row version!
        .select();

      if (updateErr || !updatedOrder || updatedOrder.length === 0) {
        throw new BadRequestException('Concurrency Collision: Order updated simultaneously by another resource.');
      }
    } else if (action.action_type === 'cancellation') {
      if (order.status === 'shipped' || order.status === 'delivered') {
        throw new BadRequestException('Guardrail Exception: Shipped targets cannot accept status alterations.');
      }

      const { data: updatedOrder, error: updateErr } = await this.supabase
        .from('orders')
        .update({ status: 'cancelled', version: order.version + 1 })
        .eq('id', order.id) // 👈 FIXED: Using the actual UUID 
        .eq('version', order.version)
        .select();

      if (updateErr || !updatedOrder || updatedOrder.length === 0) {
        throw new BadRequestException('Concurrency Collision: Order updated simultaneously by another resource.');
      }
    }

    // 5. Finalize action proposal token transformation status safely
    await this.supabase
      .from('agent_actions')
      .update({
        status: 'executed',
        reviewed_by: body.reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id);

    return { success: true, message: "Action approved and applied securely." };
  }

  @Patch('escalations/:id/reject')
  async rejectAction(@Param('id') id: string, @Body() body: { reviewerId: string }) {
    const { data, error } = await this.supabase
      .from('agent_actions')
      .update({
        status: 'rejected',
        reviewed_by: body.reviewerId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('status', 'proposed') // Avoid multi-state modifications
      .select();

    if (error || !data || data.length === 0) {
      throw new BadRequestException('Action execution could not be overridden; target state changed.');
    }

    return { success: true, message: "Escalation action dismissed cleanly." };
  }
}

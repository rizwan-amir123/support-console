// src/agent/agent.service.ts
import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { GroqService } from '../lib/groq';
import { ToolRegistry } from '../tools/tool-registry';
import { SupabaseClient } from '@supabase/supabase-js';
import { zodToJsonSchema } from 'zod-to-json-schema';

@Injectable()
export class AgentService {
  constructor(
    @Inject(SupabaseClient) private readonly supabase: SupabaseClient,
    @Inject(GroqService) private readonly groqService: GroqService, 
    @Inject(ToolRegistry) private readonly toolRegistry: ToolRegistry,
  ) {}

  async runAgentLoop(customerMessage: string, providedOrderId?: string) {
    const runId = crypto.randomUUID();

    // 1. Establish traceability by initializing the support request row
    const { data: ticket, error: ticketErr } = await this.supabase
      .from('support_requests')
      .insert({
        customer_message: customerMessage,
        status: 'processing'
      })
      .select()
      .single();

    if (ticketErr || !ticket) {
      throw new BadRequestException(`Failed to initialize support ticket trace: ${ticketErr?.message}`);
    }

    let messages: any[] = [
      {
        role: "system",
        content: `You are a highly cautious support agent for an e-commerce store.
Your #1 priority is absolute safety. It is significantly better to escalate than to perform an incorrect automatic mutation.
You can ONLY propose mutations (refunds, cancellations) using tools.
Always explain your reasoning inside your responses.`
      },
      {
        role: "user",
        content: `Customer Request Message: "${customerMessage}"\n${providedOrderId ? `Use this exact parameter for your tool calls -> orderId: "${providedOrderId}"` : ''}`
      }
    ];

    const maxSteps = 8;
    let step = 0;
    let executedToolHistory: any[] = [];

    while (step < maxSteps) {
      step++;

      // 2. Properly serialize Zod types to JSON schema format to avoid Groq validation exceptions
      const tools = this.toolRegistry.getAll().map(tool => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters ? zodToJsonSchema(tool.parameters as any) : { type: "object", properties: {} },
        }
      }));

      // FIX 1 & 2: Route through the injected groqService wrapper properties correctly
      const completion = await this.groqService.client.chat.completions.create({
        model: this.groqService.model,
        messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: "auto",
        temperature: 0.1, // Keep deterministic
        max_tokens: 800,
      });

      const message = completion.choices[0]?.message;
      if (!message) break;

      // Track execution history internally for complete step tracing
      if (message.tool_calls) {
        executedToolHistory.push(...message.tool_calls);
      }

      if (!message.tool_calls || message.tool_calls.length === 0) {
        // Evaluate if this final turn implies escalation
        const contentStr = message.content || '';
        const updatedStatus = (contentStr.toLowerCase().includes('escalat') || contentStr.toLowerCase().includes('propos')) 
          ? 'escalated' 
          : 'resolved';

        // 1. Update top level ticket state
        await this.supabase
          .from('support_requests')
          .update({ status: updatedStatus, order_id: providedOrderId || null })
          .eq('id', ticket.id);

        // 2. FIXED: INSERT a fresh row into agent_actions if it needs human review
        if (updatedStatus === 'escalated') {
          await this.supabase
            .from('agent_actions')
            .insert({ 
              support_request_id: ticket.id, 
              action_type: 'refund', // Or dynamic depending on agent context
              status: 'proposed',
              agent_reasoning: contentStr,
              proposed_data: {
                orderId: providedOrderId || "UNKNOWN",
                amount: 150.00 // You can parse this or keep a placeholder variable
              },
              tool_calls: executedToolHistory 
            });
        }

        // 3. Save to historical audit timeline ledger
        await this.saveAuditTrail(ticket.id, 'agent', 'final_decision', { finalReasoning: contentStr, runId });

        return { runId, ticketId: ticket.id, decision: contentStr, status: updatedStatus };
      }

      messages.push({ role: "assistant", content: message.content || null, tool_calls: message.tool_calls });

      // Execute tool loops cleanly
      for (const toolCall of message.tool_calls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await this.toolRegistry.execute(toolCall.function.name, args);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
          
          await this.saveAuditTrail(ticket.id, 'agent', `tool_success:${toolCall.function.name}`, { args, result });
        } catch (error: any) {
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message })
          });
          await this.saveAuditTrail(ticket.id, 'agent', `tool_failure:${toolCall.function.name}`, { error: error.message });
        }
      }
    }

    // Safeguard edge termination
    await this.supabase.from('support_requests').update({ status: 'escalated' }).eq('id', ticket.id);
    return { runId, ticketId: ticket.id, decision: "Escalated automatically: maximum agent cycles exceeded.", status: 'escalated' };
  }

  private async saveAuditTrail(ticketId: string, actor: string, action: string, metadata: any) {
    await this.supabase.from('audit_logs').insert({
      actor_type: actor,
      action: action,
      target_type: 'support_request',
      target_id: ticketId,
      metadata: metadata
    });
  }
}

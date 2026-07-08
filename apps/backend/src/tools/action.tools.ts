// src/tools/action.tools.ts
import { z } from 'zod';
import { Tool } from './tool-registry';
import { SupabaseClient } from '@supabase/supabase-js';
import { GuardrailsService } from '../guardrails/guardrails.service';

export const createActionTools = (
  supabase: SupabaseClient,
  guardrails: GuardrailsService
): Tool[] => [
  {
    name: "proposeCancellation",
    description: "Validate and escalate an e-commerce order cancellation. Use this ONLY if the customer explicitly wants to cancel an entire order that has NOT shipped yet. Do NOT call proposeRefund if you use this tool.",
    parameters: z.object({
      orderId: z.string().describe("The human-visible order_number string provided by customer (e.g., 'ORD-1043')"),
      reason: z.string().describe("Reason for cancellation")
    }).strict(),
    execute: async ({ orderId, reason }) => {
      // 1. Clean, direct lookup against order_number to fetch the internal database UUID
      const { data: orderRow, error: lookupErr } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderId)
        .maybeSingle();

      if (lookupErr || !orderRow) {
        throw new Error(`Guardrail Violation: Order reference '${orderId}' could not be verified.`);
      }

      const verifiedUuid = orderRow.id;

      // 2. Run logistics rule validation (status checks)
      await guardrails.validateCancellation(verifiedUuid);

      return {
        success: true,
        message: `Guardrails passed. Safe to escalate cancellation for order ${orderId}.`,
        status: 'validated'
      };
    }
  },

  {
    name: "proposeRefund",
    description: "Validate and propose an e-commerce order refund for specific items or amounts. Do NOT use this tool if you are already canceling the entire order via proposeCancellation.",
    parameters: z.object({
      orderId: z.string().describe("The human-visible order_number string provided by customer (e.g., 'ORD-1043')"),
      amount: z.number().positive().describe("The exact refund amount in USD being requested."),
      reason: z.string().describe("Explicit reason why the user wants a refund")
    }).strict(),
    execute: async (args: any) => {
      // 🛡️ Fail-fast: normalize mapping if the agent uses an incorrect variable name or leaves it blank
      const finalAmount = args.amount || args.refundAmount;

      if (!finalAmount || typeof finalAmount !== 'number') {
        throw new Error("Guardrail Violation: A valid, numeric 'amount' parameter must be supplied.");
      }

      const { orderId, reason } = args;

      // 1. Clean, direct lookup against order_number to fetch the internal database UUID
      const { data: orderRow, error: lookupErr } = await supabase
        .from('orders')
        .select('id')
        .eq('order_number', orderId)
        .maybeSingle();

      if (lookupErr || !orderRow) {
        throw new Error(`Guardrail Violation: Order reference '${orderId}' could not be verified.`);
      }

      const verifiedUuid = orderRow.id;

      // 2. Guardrail Validation via strict internal primary key UUID
      await guardrails.validateRefund(verifiedUuid, finalAmount);

      return {
        success: true,
        message: `Guardrails passed. Safe to escalate a refund of $${finalAmount} for order ${orderId}.`,
        status: 'validated'
      };
    }
  }
];

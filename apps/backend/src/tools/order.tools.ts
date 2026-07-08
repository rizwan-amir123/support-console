// src/tools/order.tools.ts
import { z } from 'zod';
import { Tool } from './tool-registry';
import { SupabaseClient } from '@supabase/supabase-js';

export const createOrderTools = (supabase: SupabaseClient): Tool[] => [
  {
    name: "getOrderById",
    description: "Retrieve order details by order number string (e.g., 'ORD-1043')",
    parameters: z.object({
      orderId: z.string().describe("The order number string, e.g., 'ORD-1043'")
    }),
    execute: async ({ orderId }) => {
      // Direct query against the text-based order_number column
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_number', orderId)
        .single();

      if (error || !data) return { error: "Order not found" };
      return data;
    }
  },

  {
    name: "calculateRefundAmount",
    description: "Calculate maximum eligible refund for an order using its order number string",
    parameters: z.object({
      orderId: z.string().describe("The order number string, e.g., 'ORD-1043'")
    }),
    execute: async ({ orderId }) => {
      // Direct query against the text-based order_number column here too
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, refunded_amount, status')
        .eq('order_number', orderId)
        .single();

      if (error || !data) return { error: "Order not found" };

      const total = Number(data.total_amount);
      const refunded = Number(data.refunded_amount || 0);
      const eligible = total - refunded;
      
      return {
        eligibleRefund: eligible,
        orderStatus: data.status,
        isFullyRefunded: refunded >= total
      };
    }
  }
];

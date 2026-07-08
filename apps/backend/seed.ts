import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: resolve(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Configuration Keys missing.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  console.log("🧹 Cleaning existing data...");
  // Clear tables in reverse dependency order to satisfy foreign key constraints
  await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('agent_actions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('support_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('orders').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log("📦 Seeding 5 test scenario orders...");

  const mockCustomerId = crypto.randomUUID();

  const testOrders = [
    {
      // Case 1: Standard Valid Partial Refund (Has available financial room)
      order_number: "ORD-101",
      customer_id: mockCustomerId,
      status: "delivered",
      total_amount: 150.00,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      // Case 2: Guardrail Exception - Over-Refund Limit (Order total is smaller than mutation request)
      order_number: "ORD-102",
      customer_id: mockCustomerId,
      status: "delivered",
      total_amount: 40.00,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      // Case 3: Standard Valid Cancellation (Status is eligible for pre-shipment termination)
      order_number: "ORD-103",
      customer_id: mockCustomerId,
      status: "processing",
      total_amount: 200.00,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      // Case 4: Guardrail Exception - Bad Cancellation State (Already left warehouse)
      order_number: "ORD-104",
      customer_id: mockCustomerId,
      status: "shipped",
      total_amount: 85.00,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      // Case 5: Cap Lock Breach Verification (Already fully maxed out, locked)
      order_number: "ORD-105",
      customer_id: mockCustomerId,
      status: "delivered",
      total_amount: 100.00,
      refunded_amount: 100.00,
      is_fully_refunded: true,
      version: 1
    }
  ];

  const { data: insertedOrders, error: orderError } = await supabase
    .from('orders')
    .insert(testOrders)
    .select();

  if (orderError) {
    console.error("❌ Failed to seed orders:", orderError.message);
    return;
  }

  console.log(`\n✅ Successfully seeded ${insertedOrders.length} production scenario orders!`);
  console.log("-------------------------------------------------------");
  insertedOrders.forEach(o => {
    console.log(`Order Number: ${o.order_number} -> ID: ${o.id} (${o.status}) [Cap Lock: ${o.is_fully_refunded ? '🔒' : '🔓'}]`);
  });
}

seedDatabase();

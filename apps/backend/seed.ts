// apps/backend/seed.ts
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

  console.log("📦 Seeding test orders...");

  const mockCustomerId = crypto.randomUUID();

  const testOrders = [
    {
      order_number: "ORD-1043",
      customer_id: mockCustomerId,
      status: "processing",
      total_amount: 150.00,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      order_number: "ORD-9999",
      customer_id: mockCustomerId,
      status: "shipped", // Guardrail test: should refuse manual cancellation
      total_amount: 85.50,
      refunded_amount: 0.00,
      is_fully_refunded: false,
      version: 1
    },
    {
      order_number: "ORD-5555",
      customer_id: mockCustomerId,
      status: "delivered", // Guardrail test: already fully refunded
      total_amount: 200.00,
      refunded_amount: 200.00,
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

  console.log(`✅ Successfully seeded ${insertedOrders.length} base orders!`);
  console.log("-------------------------------------------------------");
  insertedOrders.forEach(o => {
    console.log(`Order Number: ${o.order_number} -> ID: ${o.id} (${o.status})`);
  });
}

seedDatabase();

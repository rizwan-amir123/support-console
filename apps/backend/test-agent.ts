// test-agent.ts
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Explicitly pull environment keys out of your local configuration file
dotenv.config();
console.log("🔑 Checking API Key Initialization:", process.env.GROQ_API_KEY ? "LOADED SUCCESSFULLY" : "NOT FOUND (EMPTY)");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Configuration Error: SUPABASE_URL or SUPABASE_KEY is missing from environment variables.");
  process.exit(1);
}

// 2. Generate a clean, direct client instance bypassing framework dependency injection
const supabase = createClient(supabaseUrl, supabaseKey);

import { AgentService } from './src/agent/agent.service';
import { ToolRegistry } from './src/tools/tool-registry';
import { GuardrailsService } from './src/guardrails/guardrails.service';
import { createOrderTools } from './src/tools/order.tools';
import { createActionTools } from './src/tools/action.tools';

async function testAgent() {
  console.log("🚀 Starting Agent System Test Run...\n");

  const guardrails = new GuardrailsService(supabase);
  const registry = new ToolRegistry();

  // 3. Register tools with our valid client instance
  const orderTools = createOrderTools(supabase);
  const actionTools = createActionTools(supabase, guardrails);

  [...orderTools, ...actionTools].forEach((tool) => {
    registry.register(tool);
  });

  // 4. Instantiate AgentService
  const agentService = new AgentService(registry, supabase);

  const testMessage = "I want a refund for order 1043 because the item arrived damaged.";
  const testOrderId = "ORD-1043"; 

  console.log(`[Input Message]: "${testMessage}"`);
  console.log(`[Input Reference]: ${testOrderId}`);
  console.log("-------------------------------------------\n");

  try {
    const result = await agentService.runAgentLoop(testMessage, testOrderId);
    console.log("\n✅ Agent Trace Run Finished Successfully!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("\n❌ Test Engine Runtime Exception Caught:", error.message || error);
  }
}

testAgent();

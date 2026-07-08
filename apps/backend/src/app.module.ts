// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AgentService } from './agent/agent.service';
import { GroqService } from './lib/groq';
import { AgentController } from './agent/agent.controller';
import { ToolRegistry } from './tools/tool-registry';
import { GuardrailsService } from './guardrails/guardrails.service';
import { SupabaseService } from './lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { createOrderTools } from './tools/order.tools';
import { createActionTools } from './tools/action.tools';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AgentController],
  providers: [
    AgentService,
    GuardrailsService,
    GroqService,
    SupabaseService,

    // Resolve structural client dependency safely using ConfigService injection directly
    {
      provide: SupabaseClient,
      useFactory: (configService: ConfigService, supabaseService: SupabaseService) => {
        const url = configService.get<string>('SUPABASE_URL');
        const key = configService.get<string>('SUPABASE_KEY');

        if (!url || !key) {
          throw new Error('Missing SUPABASE_URL or SUPABASE_KEY in configuration engine.');
        }

        // Complete step initialization manually inside the factory boundary
        supabaseService.init(url, key);
        return supabaseService.getClient();
      },
      inject: [ConfigService, SupabaseService],
    },

    // Tool Registry Factory setup
    {
      provide: ToolRegistry,
      useFactory: (supabase: SupabaseClient, guardrails: GuardrailsService) => {
        const registry = new ToolRegistry();

        const orderTools = createOrderTools(supabase);
        const actionTools = createActionTools(supabase, guardrails);

        [...orderTools, ...actionTools].forEach(tool => {
          registry.register(tool);
        });

        console.log(`Registered ${orderTools.length + actionTools.length} tools`);
        return registry;
      },
      inject: [SupabaseClient, GuardrailsService],
    },
  ],
})
export class AppModule {}

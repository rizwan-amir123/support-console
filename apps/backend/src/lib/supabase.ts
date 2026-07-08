// src/lib/supabase.ts
import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabaseClient: SupabaseClient;

  // Accept variables directly via initialization step
  init(url: string, key: string) {
    this.supabaseClient = createClient(url, key);
  }

  getClient(): SupabaseClient {
    if (!this.supabaseClient) {
      throw new Error('SupabaseClient requested before initialization provider factory completed.');
    }
    return this.supabaseClient;
  }
}

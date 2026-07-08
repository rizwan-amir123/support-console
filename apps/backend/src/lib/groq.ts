// src/lib/groq.ts
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';

@Injectable()
export class GroqService {
  public client: Groq;
  public model = "llama-3.3-70b-versatile";

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService
  ) {
    // This runs AFTER ConfigModule has safely loaded your keys!
    const apiKey = this.configService.get<string>('GROQ_API_KEY');
    this.client = new Groq({ apiKey });
  }
}

// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AgentService } from './agent/agent.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  // 🕵️‍♂️ DIAGNOSTIC: Check if NestJS actually built the instance inside its core module container
  try {
    const serviceCheck = app.get(AgentService);
    console.log("🔍 [DI Diagnostic] AgentService inside core container:", serviceCheck ? "RESOLVED" : "NULL/UNDEFINED");
  } catch (error: any) {
    console.log("🔍 [DI Diagnostic] Container lookup threw error:", error.message || error);
  }

  await app.listen(3001);
  console.log('Backend running on http://localhost:3001');
}
bootstrap();

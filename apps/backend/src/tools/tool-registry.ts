// src/tools/tool-registry.ts
import { z } from 'zod';

export type Tool = {
  name: string;
  description: string;
  parameters: z.ZodType;
  execute: (args: any) => Promise<any>;
};

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  getAll() {
    return Array.from(this.tools.values());
  }

  async execute(name: string, args: any) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.execute(args);
  }
}

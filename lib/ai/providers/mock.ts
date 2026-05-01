import type { ProviderName } from "@/lib/memory/schemas";

export type GenerateInput = {
  systemPrompt?: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
};

export type GenerateOutput = {
  provider: ProviderName;
  model: string;
  text: string;
};

export interface AIProvider {
  name: ProviderName;
  generateText(input: GenerateInput): Promise<GenerateOutput>;
}

export class MockProvider implements AIProvider {
  name: ProviderName = "mock";

  async generateText(input: GenerateInput): Promise<GenerateOutput> {
    return {
      provider: this.name,
      model: input.model ?? "contextforge-mock",
      text: JSON.stringify(
        {
          mode: "mock",
          note: "Mock provider is active. Deterministic local heuristics are being used.",
        },
        null,
        2,
      ),
    };
  }
}

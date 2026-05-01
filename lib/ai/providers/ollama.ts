import { getOllamaBaseUrl } from "@/lib/utils/env";
import type { ProviderName } from "@/lib/memory/schemas";

import type { AIProvider, GenerateInput, GenerateOutput } from "./mock";

export class OllamaProvider implements AIProvider {
  name: ProviderName = "ollama";
  private baseUrl: string;
  private defaultModel: string;

  constructor(baseUrl = getOllamaBaseUrl()) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.defaultModel = process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";
  }

  async generateText(input: GenerateInput): Promise<GenerateOutput> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model ?? this.defaultModel,
        prompt: [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n"),
        stream: false,
        options: {
          temperature: input.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as { response?: string };
    return {
      provider: this.name,
      model: input.model ?? this.defaultModel,
      text: payload.response ?? "",
    };
  }
}

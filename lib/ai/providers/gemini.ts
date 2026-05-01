import { GoogleGenAI } from "@google/genai";

import type { ProviderName } from "@/lib/memory/schemas";

import type { AIProvider, GenerateInput, GenerateOutput } from "./mock";

export class GeminiProvider implements AIProvider {
  name: ProviderName = "gemini";
  private client: GoogleGenAI;
  private defaultModel: string;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for GeminiProvider.");
    }

    this.client = new GoogleGenAI({ apiKey });
    this.defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  }

  async generateText(input: GenerateInput): Promise<GenerateOutput> {
    const response = await this.client.models.generateContent({
      model: input.model ?? this.defaultModel,
      contents: [input.systemPrompt, input.userPrompt].filter(Boolean).join("\n\n"),
    });

    return {
      provider: this.name,
      model: input.model ?? this.defaultModel,
      text: response.text ?? "",
    };
  }
}

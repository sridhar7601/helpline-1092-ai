/**
 * Azure OpenAI client for SahayakAI.
 * Wraps the OpenAI SDK pointed at the Azure deployment.
 *
 * Used for:
 *  - Real intent classification (better than mock keyword rules, especially Kannada/Hindi)
 *  - Operator-facing case summaries
 *  - Dispatch proposal reasoning
 *
 * Falls back silently if creds aren't set.
 */

import { AzureOpenAI } from 'openai';

let _client: AzureOpenAI | null = null;

export function isAzureOpenAIEnabled(): boolean {
  return (
    process.env.USE_AZURE_OPENAI === 'true' &&
    !!process.env.AZURE_OPENAI_ENDPOINT &&
    !!process.env.AZURE_OPENAI_KEY &&
    !!process.env.AZURE_OPENAI_DEPLOYMENT
  );
}

export function getAzureClient(): AzureOpenAI {
  if (!_client) {
    if (!isAzureOpenAIEnabled()) {
      throw new Error(
        'Azure OpenAI not configured — set USE_AZURE_OPENAI=true plus AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT'
      );
    }
    _client = new AzureOpenAI({
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      apiKey: process.env.AZURE_OPENAI_KEY!,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2025-01-01-preview',
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT!,
    });
  }
  return _client;
}

/** Call GPT-4o, expect a JSON response, parse safely with retry. */
export async function callJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 1
): Promise<T> {
  const client = getAzureClient();
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT!,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 800,
      });
      const text = completion.choices[0]?.message?.content ?? '{}';
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) continue;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Azure OpenAI JSON call failed');
}

/** Call GPT-4o for a plain-text response (not JSON). */
export async function callText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400
): Promise<string> {
  const client = getAzureClient();
  const completion = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT!,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content?.trim() ?? '';
}

import { defineSecret, defineString } from 'firebase-functions/params';

/**
 * Provider-agnostic LLM access for the profile assistant and CV extraction.
 *
 * Gemini is the default. OpenAI and Anthropic stay selectable through
 * AI_PROVIDER so the provider is a deploy-time parameter rather than a code
 * change. The key is only ever read here, server-side; it never reaches a client.
 */
export const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'gemini' });
export const AI_API_KEY = defineSecret('AI_API_KEY');
export const GEMINI_MODEL = defineString('GEMINI_MODEL', { default: 'gemini-2.5-flash' });
export const OPENAI_MODEL = defineString('OPENAI_MODEL', { default: 'gpt-5.1' });
export const ANTHROPIC_MODEL = defineString('ANTHROPIC_MODEL', { default: 'claude-sonnet-5' });

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function runAi(messages: AiMessage[], maxTokens = 1800): Promise<string> {
  const provider = AI_PROVIDER.value().toLowerCase();
  if (provider === 'gemini') return runGemini(messages, maxTokens);
  if (provider === 'anthropic') return runAnthropic(messages, maxTokens);
  return runOpenAi(messages, maxTokens);
}

async function runGemini(messages: AiMessage[], maxTokens: number): Promise<string> {
  const apiKey = AI_API_KEY.value();
  if (!apiKey) throw new Error('AI_API_KEY is not configured.');
  const model = GEMINI_MODEL.value();
  const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');

  // Gemini requires a conversation that opens with a user turn and alternates
  // roles. The assistant screens open with a greeting and can send back-to-back
  // turns, so normalise rather than let the request be rejected.
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
  for (const item of messages) {
    if (item.role === 'system') continue;
    const role = item.role === 'assistant' ? 'model' : 'user';
    if (!contents.length && role === 'model') continue;
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts.push({ text: item.content });
    else contents.push({ role, parts: [{ text: item.content }] });
  }
  if (!contents.length) throw new Error('Gemini requires at least one user message.');

  const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens, temperature: 0.4 };
  // 2.5-series models spend output tokens on hidden reasoning by default, which
  // can exhaust the budget and return an empty answer. These tasks don't need it.
  if (model.startsWith('gemini-2.5')) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      // Header rather than ?key= so the key never lands in URLs or request logs.
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig,
      }),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini request failed with HTTP ${response.status}: ${detail.slice(0, 300)}`);
  }
  const body = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    promptFeedback?: { blockReason?: string };
  };
  if (body.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the prompt: ${body.promptFeedback.blockReason}.`);
  }
  const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!content) {
    throw new Error(`Gemini returned an empty response (finishReason: ${body.candidates?.[0]?.finishReason ?? 'unknown'}).`);
  }
  return content;
}

async function runOpenAi(messages: AiMessage[], maxTokens: number): Promise<string> {
  const apiKey = AI_API_KEY.value();
  if (!apiKey) throw new Error('AI_API_KEY is not configured.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL.value(), input: messages, max_output_tokens: maxTokens, store: false }),
  });
  if (!response.ok) throw new Error(`OpenAI request failed with HTTP ${response.status}.`);
  const body = await response.json() as { output_text?: string };
  const content = body.output_text?.trim();
  if (!content) throw new Error('OpenAI returned an empty response.');
  return content;
}

async function runAnthropic(messages: AiMessage[], maxTokens: number): Promise<string> {
  const apiKey = AI_API_KEY.value();
  if (!apiKey) throw new Error('AI_API_KEY is not configured.');
  const system = messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL.value(),
      system,
      messages: messages.filter((item) => item.role !== 'system'),
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) throw new Error(`Anthropic request failed with HTTP ${response.status}.`);
  const body = await response.json() as { content?: Array<{ type?: string; text?: string }> };
  const content = body.content?.filter((item) => item.type === 'text').map((item) => item.text ?? '').join('').trim();
  if (!content) throw new Error('Anthropic returned an empty response.');
  return content;
}

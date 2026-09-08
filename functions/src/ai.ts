import { defineSecret, defineString } from 'firebase-functions/params';

export const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'openai' });
export const AI_API_KEY = defineSecret('AI_API_KEY');
export const OPENAI_MODEL = defineString('OPENAI_MODEL', { default: 'gpt-5.6-luna' });
export const ANTHROPIC_MODEL = defineString('ANTHROPIC_MODEL', { default: 'claude-sonnet-4-6' });

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function runAi(messages: AiMessage[], maxTokens = 1800): Promise<string> {
  const provider = AI_PROVIDER.value().toLowerCase();
  if (provider === 'anthropic') return runAnthropic(messages, maxTokens);
  return runOpenAi(messages, maxTokens);
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

import { piCompletion } from './pi-request.mjs';
import { codexCompletion } from './codex-request.mjs';
import OpenAI from "openai";

export async function completes(
  {
    provider,
    codexDetectionMode,
    codexBinaryPath,
    piDetectionMode,
    piBinaryPath,
    baseURL,
    apiKey,
    model,
    reasoningEffort,
    contextWindowTokens,
    maxTokens = 100
  },
  messages
) {
  if (provider === 'pi-cli') return piCompletion(messages, model, { reasoningEffort, contextWindowTokens, piDetectionMode, piBinaryPath });
  if (provider === 'codex-cli') return codexCompletion(messages, model, { reasoningEffort, contextWindowTokens, codexDetectionMode, codexBinaryPath });
  const openai = new OpenAI({
    baseURL,
    apiKey,
  });

  const completion = await openai.chat.completions.create({
    messages,
    model,
    frequency_penalty: 0,
    max_tokens: maxTokens,
    temperature: 0.1
  });

  console.log(completion.choices[0].message.content);
  return completion;
}

import OpenAI from 'openai'
import type { CostSignal, Complexity, TaskType } from '@factory/types'

let _client: OpenAI | null = null
function litellm(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.LITELLM_URL ?? 'http://localhost:4000',
      apiKey: process.env.LITELLM_MASTER_KEY ?? 'sk-factory',
    })
  }
  return _client
}

function selectModel(task: TaskType, complexity: Complexity, cost: CostSignal): string {
  if (process.env.MODEL_OVERRIDE) return process.env.MODEL_OVERRIDE
  if (task === 'code') return 'codex'
  if (cost === 'low' || complexity === 'simple') return 'claude-haiku'
  if (complexity === 'complex' && cost !== 'high') return 'claude-opus'
  return 'claude-sonnet'
}

export async function routeToModel(
  prompt: string,
  task: TaskType,
  complexity: Complexity,
  costSignal: CostSignal,
  systemPrompt?: string,
): Promise<string> {
  const model = selectModel(task, complexity, costSignal)
  const response = await litellm().chat.completions.create({
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
  })
  return response.choices[0]?.message?.content ?? ''
}

export async function classifyComplexity(description: string): Promise<Complexity> {
  const prompt = `Classify the complexity of this task as exactly one word: simple, medium, or complex. Reply with only that word.\n\nTask: ${description}`
  const response = await litellm().chat.completions.create({
    model: process.env.MODEL_OVERRIDE ?? 'claude-haiku',
    messages: [{ role: 'user', content: prompt }],
  })
  const raw = (response.choices[0]?.message?.content ?? '').trim().toLowerCase()
  if (raw === 'simple' || raw === 'medium' || raw === 'complex') return raw
  return 'medium'
}

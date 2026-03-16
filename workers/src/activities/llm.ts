import OpenAI from 'openai'
import type { CostSignal, Complexity, TaskType } from '@factory/types'

const litellm = new OpenAI({
  baseURL: process.env.LITELLM_URL ?? 'http://localhost:4000',
  apiKey: process.env.LITELLM_MASTER_KEY ?? 'sk-factory',
})

// Model routing: task type + complexity + cost signal → model alias
function selectModel(task: TaskType, complexity: Complexity, cost: CostSignal): string {
  // Off-peak or simple tasks → haiku
  if (cost === 'low' || complexity === 'simple') return 'claude-haiku'
  // Complex tasks → opus (only when cost allows)
  if (complexity === 'complex' && cost !== 'high') return 'claude-opus'
  // Default
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

  const response = await litellm.chat.completions.create({
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
      { role: 'user', content: prompt },
    ],
  })

  return response.choices[0]?.message?.content ?? ''
}

export async function classifyComplexity(description: string): Promise<Complexity> {
  const response = await litellm.chat.completions.create({
    model: 'claude-haiku',
    messages: [
      {
        role: 'system',
        content: 'Classify the complexity of this task as exactly one word: simple, medium, or complex. Reply with only that word.',
      },
      { role: 'user', content: description },
    ],
  })

  const raw = response.choices[0]?.message?.content?.trim().toLowerCase() ?? 'medium'
  if (raw === 'simple' || raw === 'medium' || raw === 'complex') return raw
  return 'medium'
}

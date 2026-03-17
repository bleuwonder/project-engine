import OpenAI from 'openai'
import type { CostSignal, Complexity, TaskType } from '@factory/types'
import { claudePrompt } from './claude-agent.js'

// LLM_BACKEND=claude  → claude CLI via Max plan (~/.claude/ credentials)
// LLM_BACKEND=litellm → LiteLLM proxy via ANTHROPIC_API_KEY (default)
const BACKEND = (process.env.LLM_BACKEND ?? 'litellm') as 'claude' | 'litellm'

let _litellm: OpenAI | null = null
function litellm(): OpenAI {
  if (!_litellm) {
    _litellm = new OpenAI({
      baseURL: process.env.LITELLM_URL ?? 'http://localhost:4000',
      apiKey: process.env.LITELLM_MASTER_KEY ?? 'sk-factory',
    })
  }
  return _litellm
}

function selectModel(task: TaskType, complexity: Complexity, cost: CostSignal): string {
  if (cost === 'low' || complexity === 'simple') return 'claude-haiku'
  if (complexity === 'complex' && cost !== 'high') return 'claude-opus'
  return 'claude-sonnet'
}

async function litellmPrompt(
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

export async function routeToModel(
  prompt: string,
  task: TaskType,
  complexity: Complexity,
  costSignal: CostSignal,
  systemPrompt?: string,
): Promise<string> {
  if (BACKEND === 'claude') return claudePrompt(prompt, systemPrompt)
  return litellmPrompt(prompt, task, complexity, costSignal, systemPrompt)
}

export async function classifyComplexity(description: string): Promise<Complexity> {
  const prompt = `Classify the complexity of this task as exactly one word: simple, medium, or complex. Reply with only that word.\n\nTask: ${description}`
  const result = BACKEND === 'claude'
    ? await claudePrompt(prompt)
    : await litellmPrompt(prompt, 'discovery', 'simple', 'low')
  const raw = result.trim().toLowerCase()
  if (raw === 'simple' || raw === 'medium' || raw === 'complex') return raw
  return 'medium'
}

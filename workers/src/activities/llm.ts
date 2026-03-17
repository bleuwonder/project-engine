import type { CostSignal, Complexity, TaskType } from '@factory/types'
import { claudePrompt } from './claude-agent.js'

// Cost signal and complexity kept for interface compatibility / future routing
export async function routeToModel(
  prompt: string,
  _task: TaskType,
  _complexity: Complexity,
  _costSignal: CostSignal,
  systemPrompt?: string,
): Promise<string> {
  return claudePrompt(prompt, systemPrompt)
}

export async function classifyComplexity(description: string): Promise<Complexity> {
  const result = await claudePrompt(
    `Classify the complexity of this task as exactly one word: simple, medium, or complex. Reply with only that word.\n\nTask: ${description}`,
  )
  const raw = result.trim().toLowerCase()
  if (raw === 'simple' || raw === 'medium' || raw === 'complex') return raw
  return 'medium'
}

import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5'
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude'

// Simple single-turn text generation — replaces LiteLLM calls
export async function claudePrompt(
  prompt: string,
  systemPrompt?: string,
  maxTurns = 1,
): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt

  const args = [
    '-p', fullPrompt,
    '--output-format', 'text',
    '--max-turns', String(maxTurns),
    '--model', DEFAULT_MODEL,
    '--permission-mode', 'dontAsk',
  ]

  const { stdout } = await execFileAsync(CLAUDE_BIN, args, {
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, HOME: process.env.HOME ?? '/root' },
  })

  return stdout.trim()
}

// Full coding agent with file tools — directly writes to disk
export async function claudeCodingAgent(
  workDir: string,
  task: string,
  outputFiles: string[],
): Promise<string> {
  const prompt = [
    `Implement the following coding task. Work directly in: ${workDir}`,
    '',
    `Task: ${task}`,
    '',
    `Expected output files: ${outputFiles.join(', ')}`,
    '',
    'Use Read, Edit, Bash, Glob, and Grep tools as needed. Write code directly to the files.',
    'When complete, output a one-paragraph summary of what was implemented.',
  ].join('\n')

  const args = [
    '-p', prompt,
    '--output-format', 'text',
    '--allowedTools', 'Read,Edit,Bash,Glob,Grep',
    '--permission-mode', 'dontAsk',
    '--max-turns', '30',
    '--model', DEFAULT_MODEL,
  ]

  const { stdout } = await execFileAsync(CLAUDE_BIN, args, {
    timeout: 600_000,
    maxBuffer: 10 * 1024 * 1024,
    cwd: workDir,
    env: { ...process.env, HOME: process.env.HOME ?? '/root' },
  })

  return stdout.trim()
}

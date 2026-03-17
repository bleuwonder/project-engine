import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import OpenAI from 'openai'

const execFileAsync = promisify(execFile)

const DEFAULT_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5'
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? 'claude'
export const BACKEND = (process.env.LLM_BACKEND ?? 'litellm') as 'claude' | 'litellm'
const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? '/workspace/projects'

// ── Claude CLI backend ────────────────────────────────────────

export async function claudePrompt(
  prompt: string,
  systemPrompt?: string,
  maxTurns = 1,
): Promise<string> {
  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n---\n\n${prompt}` : prompt

  const { stdout } = await execFileAsync(CLAUDE_BIN, [
    '-p', fullPrompt,
    '--output-format', 'text',
    '--max-turns', String(maxTurns),
    '--model', DEFAULT_MODEL,
    '--permission-mode', 'dontAsk',
  ], {
    timeout: 300_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, HOME: process.env.HOME ?? '/root' },
  })

  return stdout.trim()
}

// Full coding agent — claude CLI uses Read/Edit/Bash tools to write files directly
async function claudeCliCodingAgent(projectId: string, task: string, outputFiles: string[]): Promise<string> {
  const workDir = join(PROJECTS_ROOT, projectId)
  const prompt = [
    `Implement the following coding task. Work directly in: ${workDir}`,
    `Task: ${task}`,
    `Expected output files: ${outputFiles.join(', ')}`,
    'Use Read, Edit, Bash, Glob, and Grep tools as needed. Write code directly to the files.',
    'When complete, output a one-paragraph summary of what was implemented.',
  ].join('\n\n')

  const { stdout } = await execFileAsync(CLAUDE_BIN, [
    '-p', prompt,
    '--output-format', 'text',
    '--allowedTools', 'Read,Edit,Bash,Glob,Grep',
    '--permission-mode', 'dontAsk',
    '--max-turns', '30',
    '--model', DEFAULT_MODEL,
  ], {
    timeout: 600_000,
    maxBuffer: 10 * 1024 * 1024,
    cwd: workDir,
    env: { ...process.env, HOME: process.env.HOME ?? '/root' },
  })

  return stdout.trim()
}

// ── LiteLLM backend ───────────────────────────────────────────

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

// LiteLLM coding: LLM generates code as text, we parse and write files
async function litellmCodingAgent(projectId: string, task: string, outputFiles: string[]): Promise<string> {
  const workDir = join(PROJECTS_ROOT, projectId)
  const isSingle = outputFiles.length === 1
  const prompt = isSingle
    ? [
        `Implement the following coding task for a software project.`,
        `Task: ${task}`,
        `Output ONLY the complete file content for: ${outputFiles[0]}`,
        'No markdown. No explanations. Just the code.',
      ].join('\n\n')
    : [
        `Implement the following coding task for a software project.`,
        `Task: ${task}`,
        `Output ONLY the file contents. Separate files with:`,
        `===FILE: path/to/file===`,
        `[file content]`,
        `Files to create: ${outputFiles.join(', ')}`,
      ].join('\n\n')

  const response = await litellm().chat.completions.create({
    model: 'claude-sonnet',
    messages: [{ role: 'user', content: prompt }],
  })
  const code = response.choices[0]?.message?.content ?? ''

  if (isSingle) {
    const filePath = join(workDir, outputFiles[0])
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, code, 'utf-8')
  } else {
    const blocks = code.split(/===FILE:\s*(.+?)===/)
    for (let i = 1; i < blocks.length; i += 2) {
      const rel = blocks[i].trim()
      const content = blocks[i + 1]?.trim() ?? ''
      if (rel && content) {
        const filePath = join(workDir, rel)
        mkdirSync(dirname(filePath), { recursive: true })
        writeFileSync(filePath, content, 'utf-8')
      }
    }
  }

  return `LiteLLM: implemented ${outputFiles.join(', ')}`
}

// ── Public entrypoint (backend-agnostic) ─────────────────────

export async function claudeCodingAgent(
  projectId: string,
  task: string,
  outputFiles: string[],
): Promise<string> {
  if (BACKEND === 'claude') return claudeCliCodingAgent(projectId, task, outputFiles)
  return litellmCodingAgent(projectId, task, outputFiles)
}

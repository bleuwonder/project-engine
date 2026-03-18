import OpenAI from 'openai'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'

const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? '/workspace/projects'

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

export async function codingAgent(
  projectId: string,
  task: string,
  outputFiles: string[],
): Promise<string> {
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
    model: 'codex',
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

  return `codex: implemented ${outputFiles.join(', ')}`
}

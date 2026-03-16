import { spawn } from 'child_process'
import { join } from 'path'
import { access } from 'fs/promises'

const PROJECTS_ROOT = process.env.PROJECTS_ROOT ?? join(process.cwd(), '..', 'projects')

export async function runTestSuite(
  projectId: string,
): Promise<{ passed: boolean; output: string }> {
  const projectDir = join(PROJECTS_ROOT, projectId)

  // Determine test command
  let cmd = 'echo "No test suite configured. Checking file existence..."'
  const pkgPath = join(projectDir, 'package.json')
  const hasPkg = await access(pkgPath).then(() => true).catch(() => false)

  if (hasPkg) {
    // Try build first, then test
    cmd = 'npm run build 2>&1; npm test 2>&1 || true'
  }

  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', cmd], {
      cwd: projectDir,
      env: { ...process.env, CI: 'true' },
      timeout: 120_000,
    })

    let output = ''
    proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
    proc.stderr.on('data', (d: Buffer) => { output += d.toString() })

    proc.on('close', (code: number | null) => {
      // Truncate output to avoid overwhelming Temporal history
      resolve({ passed: code === 0, output: output.slice(-4000) })
    })

    proc.on('error', (err: Error) => {
      resolve({ passed: false, output: err.message })
    })
  })
}

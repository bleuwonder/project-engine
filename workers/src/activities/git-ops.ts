import simpleGit from 'simple-git'
import { join } from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? join(process.cwd(), '..', '..')

function git() {
  return simpleGit(WORKSPACE, {
    config: [
      'user.name=factory-bot',
      'user.email=factory-bot@bleuwonder.io',
    ],
  })
}

export async function gitCreateBranch(branchName: string): Promise<void> {
  await git().checkoutLocalBranch(branchName)
}

export async function gitCheckoutMain(): Promise<void> {
  await git().checkout('main')
}

export async function gitCommitFiles(message: string, files: string[]): Promise<string> {
  const g = git()
  await g.add(files)
  const result = await g.commit(message)
  return result.commit
}

export async function gitPushBranch(branchName: string): Promise<void> {
  const token = process.env.GITHUB_TOKEN
  const repo = process.env.GITHUB_REPO ?? 'bleuwonder/project-engine'
  if (!token) throw new Error('GITHUB_TOKEN not set')
  await git().push(`https://${token}@github.com/${repo}.git`, branchName)
}

export async function gitCurrentBranch(): Promise<string> {
  const status = await git().status()
  return status.current ?? 'main'
}

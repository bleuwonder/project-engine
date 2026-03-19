import { simpleGit } from 'simple-git'
import { join } from 'path'

const WORKSPACE = process.env.WORKSPACE_ROOT ?? join(process.cwd(), '..', '..')

function git() {
  const token = process.env.GITHUB_TOKEN
  const config = [
    'user.name=factory-bot',
    'user.email=factory-bot@bleuwonder.io',
  ]
  // Configure credential helper to inject token without exposing it in URLs
  if (token) {
    config.push(`credential.helper=!f() { echo "password=${token}"; echo "username=x-access-token"; }; f`)
  }
  return simpleGit(WORKSPACE, { config })
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
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set')
  const repo = process.env.GITHUB_REPO ?? 'bleuwonder/project-engine'
  await git().push(`https://github.com/${repo}.git`, branchName)
}

export async function gitCurrentBranch(): Promise<string> {
  const status = await git().status()
  return status.current ?? 'main'
}

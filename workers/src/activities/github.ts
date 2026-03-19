import { Octokit } from '@octokit/rest'

function octokit(): Octokit {
  if (!process.env.GITHUB_TOKEN) throw new Error('GITHUB_TOKEN not set')
  return new Octokit({ auth: process.env.GITHUB_TOKEN })
}

function parseRepo(): { owner: string; repo: string } {
  const [owner, repo] = (process.env.GITHUB_REPO ?? 'bleuwonder/project-engine').split('/')
  return { owner, repo }
}

export async function createPullRequest(
  branchName: string,
  title: string,
  body: string,
): Promise<{ prUrl: string; prNumber: number }> {
  const { owner, repo } = parseRepo()
  const ok = octokit()

  // Idempotency: check for existing open PR from this branch
  const { data: existing } = await ok.pulls.list({
    owner, repo,
    head: `${owner}:${branchName}`,
    state: 'open',
    per_page: 1,
  })
  if (existing.length > 0) {
    return { prUrl: existing[0].html_url, prNumber: existing[0].number }
  }

  const { data } = await ok.pulls.create({
    owner, repo,
    title,
    body,
    head: branchName,
    base: 'main',
  })
  return { prUrl: data.html_url, prNumber: data.number }
}

export async function mergePullRequest(prNumber: number): Promise<void> {
  const { owner, repo } = parseRepo()
  const ok = octokit()

  // Idempotency: check if already merged
  const { data: pr } = await ok.pulls.get({ owner, repo, pull_number: prNumber })
  if (pr.merged) return

  await ok.pulls.merge({
    owner, repo,
    pull_number: prNumber,
    merge_method: 'squash',
  })
}

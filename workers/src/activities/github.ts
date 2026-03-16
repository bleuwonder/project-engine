import { Octokit } from '@octokit/rest'

function octokit(): Octokit {
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
  const { data } = await octokit().pulls.create({
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
  await octokit().pulls.merge({
    owner, repo,
    pull_number: prNumber,
    merge_method: 'squash',
  })
}

import { ApplicationFailure } from '@temporalio/activity'
import { readProjectFile } from './git.js'

// GOALS.md must contain "Metric:" followed by a number somewhere on that line
function hasMeasurableMetric(content: string): boolean {
  return /Metric:.*\d/.test(content)
}

export async function checkMetricsGate(projectId: string): Promise<void> {
  const goals = await readProjectFile(projectId, 'GOALS.md')

  if (!hasMeasurableMetric(goals)) {
    throw ApplicationFailure.create({
      message: `MetricsGateFailure: GOALS.md for project "${projectId}" has no measurable metric. Add a line like "Metric: <description> (target: <number>)" and re-signal.`,
      nonRetryable: true,
    })
  }
}

import { Client, Connection } from '@temporalio/client'
import type { DiscoveryState } from '@factory/types'
import {
  DiscoveryWorkflow,
  userMessageSignal,
  approvePlanSignal,
  currentStateQuery,
} from '../../../workers/src/workflows/index.js'

let _client: Client | null = null

async function getClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    })
    _client = new Client({ connection })
  }
  return _client
}

export async function startProject(projectId: string): Promise<string> {
  const client = await getClient()
  const handle = await client.workflow.start(DiscoveryWorkflow, {
    taskQueue: 'factory',
    workflowId: `project-${projectId}-discovery`,
    args: [projectId],
  })
  return handle.workflowId
}

export async function sendMessage(workflowId: string, message: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal(userMessageSignal, message)
}

export async function approvePlan(workflowId: string): Promise<void> {
  const client = await getClient()
  await client.workflow.getHandle(workflowId).signal(approvePlanSignal)
}

export async function getState(workflowId: string): Promise<DiscoveryState> {
  const client = await getClient()
  return client.workflow.getHandle(workflowId).query(currentStateQuery)
}

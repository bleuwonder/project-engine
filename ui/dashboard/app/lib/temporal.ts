import { Client, Connection } from '@temporalio/client'

let _client: Client | null = null

export async function getTemporalClient(): Promise<Client> {
  if (!_client) {
    const connection = await Connection.connect({
      address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
    })
    _client = new Client({ connection })
  }
  return _client
}

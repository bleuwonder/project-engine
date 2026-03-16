import { Worker, NativeConnection } from '@temporalio/worker'
import * as activities from './activities/index.js'

async function run(): Promise<void> {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS ?? 'localhost:7233',
  })

  const worker = await Worker.create({
    connection,
    namespace: 'default',
    taskQueue: 'factory',
    workflowsPath: new URL('./workflows/index.js', import.meta.url).pathname,
    activities,
  })

  console.log('Worker started on task queue: factory')
  await worker.run()
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})

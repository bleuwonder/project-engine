import { migrate } from './schema.js'
import { sql } from './client.js'

await migrate()
await sql.end()

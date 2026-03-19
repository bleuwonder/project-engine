import OpenAI from 'openai'

let _client: OpenAI | null = null

export function litellm(): OpenAI {
  if (!_client) {
    if (!process.env.LITELLM_MASTER_KEY) {
      throw new Error('LITELLM_MASTER_KEY env var is required')
    }
    _client = new OpenAI({
      baseURL: process.env.LITELLM_URL ?? 'http://litellm:4000',
      apiKey: process.env.LITELLM_MASTER_KEY,
    })
  }
  return _client
}

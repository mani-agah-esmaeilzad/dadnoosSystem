import { encoding_for_model, get_encoding, Tiktoken } from '@dqbd/tiktoken'

import { env } from '@/lib/env'

let cachedEncoder: Tiktoken | null = null
let cachedModel: string | null = null

function resolveEncoding() {
  const targetModel = env.LLM_MODEL
  if (cachedEncoder && cachedModel === targetModel) {
    return cachedEncoder
  }

  try {
    cachedEncoder = encoding_for_model(targetModel as any)
    cachedModel = targetModel
    return cachedEncoder
  } catch (error) {
    console.warn(`Falling back to cl100k_base tokenizer for model ${targetModel}:`, error)
    cachedEncoder = get_encoding('cl100k_base')
    cachedModel = targetModel
    return cachedEncoder
  }
}

export function countTokens(text: string) {
  const encoder = resolveEncoding()
  if (!text) return 0
  return encoder.encode(text).length
}

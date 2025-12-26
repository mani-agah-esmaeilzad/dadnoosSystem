import type { LlmMessage } from '@/lib/llm/client'

const CHARS_PER_TOKEN = 4

export function estimateTokensFromText(text: string) {
  const normalized = text || ''
  return Math.max(1, Math.ceil(normalized.length / CHARS_PER_TOKEN))
}

export function estimateTokensFromMessages(messages: LlmMessage[]) {
  return messages.reduce((sum, msg) => sum + estimateTokensFromText(msg.content), 0)
}

import { SYSTEM_PROMPT } from '@/lib/agent/systemPrompt'
import { createChatCompletion, LlmMessage } from '@/lib/llm/client'

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentMetadataAttachment {
  name?: string | null
  mime?: string | null
  size?: number | null
  summary?: string | null
}

export interface AgentMetadata {
  attachments?: AgentMetadataAttachment[]
  notes?: string
}

export interface RunAgentInput {
  message: string
  history?: ConversationTurn[]
  summaryJson?: string
  metadata?: AgentMetadata
  modulePrompt?: string
  articleLookupJson?: string
}

export interface RunAgentResult {
  text: string
}

const MAX_ATTACHMENT_CONTEXT = 6000
const MAX_PER_ATTACHMENT = 600

function formatMetadata(metadata?: AgentMetadata) {
  if (!metadata) return ''
  const parts: string[] = []
  const attachments = metadata.attachments || []
  if (attachments.length) {
    let used = 0
    const blocks: string[] = []
    attachments.forEach((att, idx) => {
      if (used >= MAX_ATTACHMENT_CONTEXT) {
        return
      }
      const header = `فایل ${idx + 1}: ${att?.name || 'بدون نام'} (${att?.mime || 'بدون نوع'}, ${att?.size || '?'} بایت)`
      const snippetSource = att.summary || 'متن استخراج نشد.'
      const remaining = Math.max(0, MAX_ATTACHMENT_CONTEXT - used - header.length)
      if (remaining <= 0) {
        return
      }
      const snippet = snippetSource.slice(0, Math.min(MAX_PER_ATTACHMENT, remaining))
      const block = `${header}\n${snippet}`
      used += block.length
      blocks.push(block)
    })
    if (blocks.length) {
      parts.push(`[خلاصه پیوست‌ها]\n${blocks.join('\n\n')}`)
    }
  }
  if (metadata.notes) {
    parts.push(`یادداشت سیستم:\n${metadata.notes}`)
  }
  if (parts.length === 0) return ''
  return `\n\n[اطلاعات کمکی]\n${parts.join('\n\n')}`
}

export interface BuildAgentMessagesInput {
  history: ConversationTurn[]
  message: string
  metadata?: AgentMetadata
  summaryJson?: string
  modulePrompt?: string
  articleLookupJson?: string
}

export function buildAgentMessages({
  history,
  message,
  metadata,
  summaryJson,
  modulePrompt,
  articleLookupJson,
}: BuildAgentMessagesInput): LlmMessage[] {
  const llmMessages: LlmMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  if (modulePrompt) {
    llmMessages.push({ role: 'system', content: modulePrompt })
  }

  if (summaryJson) {
    llmMessages.push({
      role: 'system',
      content: `CONVERSATION_SUMMARY_JSON:\n${summaryJson}`,
    })
  }

  if (articleLookupJson) {
    llmMessages.push({
      role: 'system',
      content: `ARTICLE_LOOKUP_RESULTS_JSON:\n${articleLookupJson}`,
    })
  }

  history.forEach((turn) => {
    if (turn.role === 'user' || turn.role === 'assistant') {
      llmMessages.push({ role: turn.role, content: turn.content })
    }
  })

  llmMessages.push({ role: 'user', content: `${message}${formatMetadata(metadata)}` })
  return llmMessages
}

export async function runAgent({
  message,
  history = [],
  metadata,
  summaryJson,
  modulePrompt,
  articleLookupJson,
}: RunAgentInput): Promise<RunAgentResult> {
  const llmMessages = buildAgentMessages({
    history,
    message,
    metadata,
    summaryJson,
    modulePrompt,
    articleLookupJson,
  })

  const text = await createChatCompletion({ messages: llmMessages })
  return { text }
}

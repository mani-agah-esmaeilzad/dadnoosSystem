import { z } from 'zod'

import { env } from '@/lib/env'
import { createChatCompletion, LlmMessage } from '@/lib/llm/client'

export const conversationSummarySchema = z.object({
  summary_version: z.number(),
  jurisdiction: z.literal('Iran'),
  domain: z.string().default('general'),
  user_profile: z.object({
    name_or_handle: z.string().nullable().default(null),
    preferences: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
  }),
  facts_confirmed: z.array(z.string()).default([]),
  claims_unverified: z.array(z.string()).default([]),
  timeline: z
    .array(
      z.object({
        date: z.string().nullable().default(null),
        event: z.string(),
      })
    )
    .default([]),
  open_questions: z.array(z.string()).default([]),
  decisions_and_actions: z.array(z.string()).default([]),
  important_entities: z.object({
    people: z.array(z.string()).default([]),
    organizations: z.array(z.string()).default([]),
    places: z.array(z.string()).default([]),
    documents: z.array(z.string()).default([]),
  }),
  legal_context_if_any: z.object({
    keywords: z.array(z.string()).default([]),
    articles_or_laws_verified: z.array(z.string()).default([]),
    articles_or_laws_needing_verification: z.array(z.string()).default([]),
  }),
  last_updated_iso: z.string(),
})

export type ConversationSummary = z.infer<typeof conversationSummarySchema>

export interface SummarizableMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUMMARIZER_SYSTEM_PROMPT =
  'You are a summarization engine. Output ONLY valid JSON matching the provided schema. Do not add facts. If a previous summary is provided, merge and update it. Prefer brevity. Use Persian text for values where natural. Jurisdiction is Iran.'

export async function generateConversationSummary({
  previousSummary,
  messages,
  targetVersion,
}: {
  previousSummary: ConversationSummary | null
  messages: SummarizableMessage[]
  targetVersion: number
}): Promise<{ summaryObject: ConversationSummary; summaryText: string }> {
  if (!messages.length) {
    throw new Error('No messages provided for summarization')
  }

  const payload = {
    previous_summary_json: previousSummary,
    new_messages: messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
  }

  const summarizerMessages: LlmMessage[] = [
    { role: 'system', content: SUMMARIZER_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(payload) },
  ]

  const rawSummary = await createChatCompletion({
    model: env.SUMMARY_MODEL || env.LLM_MODEL,
    messages: summarizerMessages,
    temperature: 0.1,
    maxTokens: env.SUMMARY_TARGET_TOKENS,
  })

  let parsed: ConversationSummary
  try {
    parsed = conversationSummarySchema.parse(JSON.parse(rawSummary))
  } catch (error) {
    throw new Error(`Summarizer did not return valid JSON: ${(error as Error).message}`)
  }

  parsed.summary_version = targetVersion
  parsed.jurisdiction = 'Iran'
  parsed.last_updated_iso = new Date().toISOString()

  return {
    summaryObject: parsed,
    summaryText: JSON.stringify(parsed),
  }
}

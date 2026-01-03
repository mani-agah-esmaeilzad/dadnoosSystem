import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { runAgent, buildAgentMessages, type AgentMetadata } from '@/lib/agent/runner'
import { requireAuth } from '@/lib/auth/guards'
import { chatRequestSchema } from '@/lib/chat/schema'
import { enforceRateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { enforceBodySizeLimit } from '@/lib/http/bodyLimit'
import { HttpError } from '@/lib/http/errors'
import { estimateTokensFromMessages, estimateTokensFromText } from '@/lib/llm/tokens'
import { isBuildTime } from '@/lib/runtime/build'
import { planConversation } from '@/lib/chat/plan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    if (isBuildTime) {
      return NextResponse.json({
        response: 'سیستم در حال آماده‌سازی است. لطفاً بعداً دوباره تلاش کنید.',
        build_placeholder: true,
      })
    }

    const [{ prisma }, { prepareChatContext }, { serializeContent }, quotaModule] = await Promise.all([
      import('@/lib/db/prisma'),
      import('@/lib/chat/context'),
      import('@/lib/chat/messages'),
      import('@/lib/billing/quota'),
    ])

    const { enforceQuota, recordUsage } = quotaModule

    const auth = requireAuth(req)
    enforceBodySizeLimit(req, env.MAX_UPLOAD_BYTES * 2)
    await enforceRateLimit({
      key: `ratelimit:chat:${auth.sub}`,
      limit: env.RATE_LIMIT_MAX_REQUESTS,
      windowSeconds: env.RATE_LIMIT_WINDOW_SEC,
    })

    const payload = await req.json()
    const body = chatRequestSchema.parse(payload)
    const prepared = await prepareChatContext(auth.sub, body)

    const plan = await planConversation({
      userId: auth.sub,
      chatId: prepared.sessionChatId,
      message: prepared.userPlainText,
      summaryJson: prepared.summaryJson,
      history: prepared.history,
      sessionMetadata: prepared.sessionMetadata,
    })

    if (plan.mode === 'intake' && plan.intakeResponse) {
      const text = plan.intakeResponse
      const assistantTokens = estimateTokensFromText(text)
      await prisma.message.create({
        data: {
          id: crypto.randomUUID(),
          userId: auth.sub,
          chatId: prepared.sessionChatId,
          role: 'assistant',
          content: serializeContent([{ type: 'text', text }]),
          tokenCount: assistantTokens,
        },
      })
      return NextResponse.json({ response: text })
    }

    const agentMetadata: AgentMetadata = {}
    if (prepared.attachmentContext.length) {
      agentMetadata.attachments = prepared.attachmentContext
    }
    if (plan.metadataNote) {
      agentMetadata.notes = plan.metadataNote
    }
    const metadata = Object.keys(agentMetadata).length ? agentMetadata : undefined
    const agentMessages = buildAgentMessages({
      history: prepared.history,
      message: prepared.userPlainText,
      metadata,
      summaryJson: prepared.summaryJson || undefined,
      modulePrompt: plan.modulePrompt,
      articleLookupJson: plan.articleLookupJson ?? undefined,
    })
    const estimatedPromptTokens = estimateTokensFromMessages(agentMessages)

    await enforceQuota(auth.sub, estimatedPromptTokens)

    const agent = await runAgent({
      message: prepared.userPlainText,
      history: prepared.history,
      summaryJson: prepared.summaryJson || undefined,
      metadata,
      modulePrompt: plan.modulePrompt,
      articleLookupJson: plan.articleLookupJson ?? undefined,
    })

    const assistantTokens = estimateTokensFromText(agent.text)
    await recordUsage(auth.sub, estimatedPromptTokens + assistantTokens)

    await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        userId: auth.sub,
        chatId: prepared.sessionChatId,
        role: 'assistant',
        content: serializeContent([{ type: 'text', text: agent.text }]),
        tokenCount: assistantTokens,
      },
    })

    return NextResponse.json({ response: agent.text })
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ detail: error.message }, { status: error.status })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ detail: 'JSON بدفرمت است.' }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ detail: 'ورودی نامعتبر است.', issues: error.flatten() }, { status: 400 })
    }
    console.error('Chat endpoint error:', error)
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

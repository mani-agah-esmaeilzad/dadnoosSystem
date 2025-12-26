import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { runAgent, buildAgentMessages } from '@/lib/agent/runner'
import { prisma } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/guards'
import { chatRequestSchema } from '@/lib/chat/schema'
import { prepareChatContext } from '@/lib/chat/context'
import { serializeContent } from '@/lib/chat/messages'
import { enforceRateLimit } from '@/lib/rate-limit'
import { env } from '@/lib/env'
import { enforceBodySizeLimit } from '@/lib/http/bodyLimit'
import { HttpError } from '@/lib/http/errors'
import { estimateTokensFromMessages, estimateTokensFromText } from '@/lib/llm/tokens'
import { enforceQuota, recordUsage } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
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

    const metadata = prepared.attachmentContext.length
      ? { attachments: prepared.attachmentContext }
      : undefined
    const agentMessages = buildAgentMessages(prepared.history, prepared.userPlainText, metadata)
    const estimatedPromptTokens = estimateTokensFromMessages(agentMessages)

    await enforceQuota(auth.sub, estimatedPromptTokens)

    const agent = await runAgent({
      message: prepared.userPlainText,
      history: prepared.history,
      metadata,
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
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

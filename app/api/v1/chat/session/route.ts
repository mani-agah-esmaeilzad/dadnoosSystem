import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/guards'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    for (let i = 0; i < 3; i += 1) {
      const chatId = crypto.randomUUID().replace(/-/g, '')
      try {
        const session = await prisma.chatSession.create({
          data: {
            userId: auth.sub,
            chatId,
          },
        })
        return NextResponse.json({ chat_id: session.chatId, created_at: session.createdAt.toISOString() })
      } catch (error) {
        continue
      }
    }
    return NextResponse.json({ detail: 'Unable to allocate chat session' }, { status: 500 })
  } catch (error) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

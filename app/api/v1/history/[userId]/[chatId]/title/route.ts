import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/guards'

const bodySchema = z.object({ title: z.string().min(1) })

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ userId: string; chatId: string }> }
) {
  try {
    const { userId, chatId } = await context.params
    const auth = requireAuth(req)
    if (auth.sub !== userId) {
      return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
    }
    const body = bodySchema.parse(await req.json())

    const existing = await prisma.chatSession.findUnique({
      where: { userId_chatId: { userId: auth.sub, chatId } },
    })
    if (!existing) {
      return NextResponse.json({ detail: 'Chat not found' }, { status: 404 })
    }

    const updated = await prisma.chatSession.update({
      where: { userId_chatId: { userId: auth.sub, chatId } },
      data: { title: body.title.trim() },
    })

    return NextResponse.json({
      chat_id: updated.chatId,
      user_id: updated.userId,
      title: updated.title,
      created_at: updated.createdAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ detail: 'عنوان معتبر نیست.', issues: error.flatten() }, { status: 400 })
    }
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

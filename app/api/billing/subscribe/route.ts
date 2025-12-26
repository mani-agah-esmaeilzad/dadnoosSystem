import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/guards'
import { ensureDefaultPlan } from '@/lib/billing/defaultPlan'

const bodySchema = z.object({
  plan_id: z.string().min(1),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    await ensureDefaultPlan()
    const body = bodySchema.parse(await req.json())

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: body.plan_id } })
    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found.' }, { status: 404 })
    }

    await prisma.userSubscription.updateMany({
      where: { userId: auth.sub, active: true },
      data: { active: false },
    })

    const now = new Date()
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)

    const subscription = await prisma.userSubscription.create({
      data: {
        userId: auth.sub,
        planId: plan.id,
        tokenQuota: plan.tokenQuota,
        tokensUsed: 0,
        startedAt: now,
        expiresAt,
        active: true,
      },
      include: { plan: true },
    })

    return NextResponse.json({
      id: subscription.id,
      plan_id: subscription.planId,
      plan_code: subscription.plan?.code,
      plan_title: subscription.plan?.title,
      token_quota: subscription.tokenQuota,
      tokens_used: subscription.tokensUsed,
      remaining_tokens: subscription.tokenQuota - subscription.tokensUsed,
      started_at: subscription.startedAt.toISOString(),
      expires_at: subscription.expiresAt.toISOString(),
      active: subscription.active,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ detail: 'درخواست نامعتبر است.', issues: error.flatten() }, { status: 400 })
    }
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

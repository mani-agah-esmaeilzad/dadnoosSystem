import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { requireAuth } from '@/lib/auth/guards'
import { getActiveSubscription } from '@/lib/billing/quota'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req)
    const subscription = await getActiveSubscription(auth.sub)

    if (!subscription) {
      return NextResponse.json({ has_subscription: false, subscription: null })
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: subscription.planId || '' } })
    const payload = {
      id: subscription.id,
      plan_id: subscription.planId,
      plan_code: plan?.code,
      plan_title: plan?.title,
      token_quota: subscription.tokenQuota,
      tokens_used: subscription.tokensUsed,
      remaining_tokens: subscription.tokenQuota - subscription.tokensUsed,
      started_at: subscription.startedAt.toISOString(),
      expires_at: subscription.expiresAt.toISOString(),
      active: subscription.active,
    }

    return NextResponse.json({ has_subscription: true, subscription: payload })
  } catch (error) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

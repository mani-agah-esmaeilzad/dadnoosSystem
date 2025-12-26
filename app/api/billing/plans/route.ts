import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { ensureDefaultPlan } from '@/lib/billing/defaultPlan'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    await ensureDefaultPlan()
    const includeOrg = req.nextUrl.searchParams.get('include_org') === 'true'
    const plans = await prisma.subscriptionPlan.findMany({
      where: includeOrg ? {} : { isOrganizational: false },
      orderBy: { createdAt: 'asc' },
    })

    const payload = plans.map((plan) => ({
      id: plan.id,
      code: plan.code,
      title: plan.title,
      duration_days: plan.durationDays,
      token_quota: plan.tokenQuota,
      is_organizational: plan.isOrganizational,
    }))

    return NextResponse.json({ plans: payload })
  } catch (error) {
    const status = (error as { status?: number }).status || 500
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ detail: message }, { status })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/db/prisma'
import { env } from '@/lib/env'
import { issueAccessToken, asTokenResponse } from '@/lib/auth/jwt'
import { normalizePhone, isValidPhone, otpAttemptsKey, otpKey, otpVerifiedKey } from '@/lib/auth/otp'
import { redis } from '@/lib/redis/client'

const verifySchema = z.object({
  phone: z.string().min(5),
  code: z.string().min(4).max(16),
})

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function ensureUser(phone: string) {
  const existing = await prisma.user.findFirst({ where: { username: phone } })
  if (existing) return existing
  return prisma.user.create({
    data: {
      username: phone,
    },
  })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone, code } = verifySchema.parse(body)

    const normalized = normalizePhone(phone)
    if (!isValidPhone(normalized)) {
      return NextResponse.json({ detail: 'فرمت شماره موبایل نامعتبر است.' }, { status: 400 })
    }

    const staticPhone = env.OTP_STATIC_LOGIN_PHONE && normalizePhone(env.OTP_STATIC_LOGIN_PHONE)
    const staticCode = env.OTP_STATIC_LOGIN_CODE || env.OTP_FIXED_CODE

    const trimmedCode = code.trim()

    let verified = false
    if (env.OTP_DEV_MODE && trimmedCode === env.OTP_FIXED_CODE) {
      verified = true
    } else if (staticPhone && normalized === staticPhone && trimmedCode === staticCode) {
      verified = true
    } else if (env.OTP_BYPASS_IN_DEV && env.OTP_ACCEPT_MASTER_CODE && trimmedCode === env.OTP_FIXED_CODE) {
      verified = true
    } else {
      const realCode = await redis.get(otpKey(normalized))
      if (!realCode) {
        return NextResponse.json({ detail: 'کد منقضی شده یا درخواستی ثبت نشده است.' }, { status: 400 })
      }

      const attemptsRaw = await redis.get(otpAttemptsKey(normalized))
      const attemptsLeft = attemptsRaw ? parseInt(attemptsRaw, 10) : env.OTP_MAX_ATTEMPTS
      if (attemptsLeft <= 0) {
        await redis.del(otpKey(normalized), otpAttemptsKey(normalized))
        return NextResponse.json({ detail: 'تعداد تلاش‌ها به پایان رسیده است.' }, { status: 429 })
      }

      if (realCode.trim() !== trimmedCode) {
        await redis.decr(otpAttemptsKey(normalized))
        return NextResponse.json({ detail: 'کد نادرست است.' }, { status: 401 })
      }

      verified = true
      await redis.del(otpKey(normalized), otpAttemptsKey(normalized))
    }

    if (!verified) {
      return NextResponse.json({ detail: 'کد نادرست است.' }, { status: 401 })
    }

    await redis.setex(otpVerifiedKey(normalized), 600, '1')

    const user = await ensureUser(normalized)
    const issued = issueAccessToken({ sub: user.id })
    const response = asTokenResponse(issued)
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ detail: 'ورودی نامعتبر است.', issues: error.flatten() }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : String(error)
    console.error('OTP verify error', message)
    return NextResponse.json({ detail: 'Internal server error' }, { status: 500 })
  }
}

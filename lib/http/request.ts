import type { NextRequest } from 'next/server'

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') || req.headers.get('X-Forwarded-For')
  if (forwarded) {
    const ip = forwarded.split(',')[0]?.trim()
    if (ip) return ip
  }
  if (req.ip) return req.ip
  return 'unknown'
}

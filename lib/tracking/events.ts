import { prisma } from '@/lib/db/prisma'

interface TrackingEventInput {
  userId?: string
  eventType: string
  source?: string
  payload?: Record<string, unknown>
}

export async function recordTrackingEvent({ userId, eventType, source, payload }: TrackingEventInput) {
  try {
    const trackingModel = (prisma as typeof prisma & { trackingEvent?: typeof prisma.trackingEvent }).trackingEvent
    if (!trackingModel?.create) {
      return
    }
    await trackingModel.create({
      data: {
        userId,
        eventType,
        source,
        payload,
      },
    })
  } catch (error) {
    console.warn('Failed to record tracking event', eventType, (error as Error).message)
  }
}

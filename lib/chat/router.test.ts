import { describe, expect, it } from 'vitest'

import { applyStickyRouting, detectExplicitModuleIntent, detectFollowUp } from '@/lib/chat/router'
import type { RouterDecision } from '@/lib/chat/sessionMetadata'

function decision(module: RouterDecision['module'], confidence: number, notes = 'switch') {
  return {
    module,
    confidence,
    required_metadata: [],
    notes,
    decidedAt: new Date().toISOString(),
  }
}

describe('router helpers', () => {
  it('detects follow-up intents', () => {
    expect(detectFollowUp('ادامه بده')).toBe(true)
    expect(detectFollowUp('باشه ادامه بده')).toBe(true)
    expect(detectFollowUp('سوال جدید')).toBe(false)
  })

  it('recognizes explicit module keywords', () => {
    expect(detectExplicitModuleIntent('لطفاً قرارداد جدید بنویس')).toBe('contract_drafting')
    expect(detectExplicitModuleIntent('یک دادخواست تنظیم کن')).toBe('petitions_complaints')
    expect(detectExplicitModuleIntent('سوال عمومی دارم')).toBeNull()
  })

  it('sticks to active module when follow-up is detected and router confidence is low', () => {
    const result = applyStickyRouting({
      activeModule: 'contract_drafting',
      followUp: true,
      explicitIntent: null,
      routerDecision: decision('contract_review', 0.4, 'maybe switch'),
    })
    expect(result).toBe('contract_drafting')
  })

  it('switches modules when router is confident and has notes', () => {
    const result = applyStickyRouting({
      activeModule: 'generic_chat',
      followUp: true,
      explicitIntent: null,
      routerDecision: decision('contract_review', 0.9, 'کاربر درباره تحلیل قرارداد پرسید'),
    })
    expect(result).toBe('contract_review')
  })
})

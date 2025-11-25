import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/jwt', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    survey: { findUnique: vi.fn() },
    response: { findMany: vi.fn() },
    member: { findMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth/jwt'

describe('Non-respondents API - Basic', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('requires authentication', async () => {
    ;(verifyToken as any).mockResolvedValue(null)

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => undefined },
    }

    // Import the route dynamically to avoid issues
    const { GET } = await import('../app/api/surveys/[id]/non-respondents/route')
    const res: any = await GET(req, { params: { id: 'survey1' } })
    expect(res.status).toBe(401)
  })

  it('returns 404 for non-existent survey', async () => {
    ;(verifyToken as any).mockResolvedValue({ adminId: 'admin1' })
    ;(prisma.survey.findUnique as any).mockResolvedValue(null)

    const req: any = {
      headers: { get: () => null },
      cookies: { get: () => ({ value: 'token' }) },
    }

    const { GET } = await import('../app/api/surveys/[id]/non-respondents/route')
    const res: any = await GET(req, { params: { id: 'nonexistent' } })
    expect(res.status).toBe(404)
  })
})
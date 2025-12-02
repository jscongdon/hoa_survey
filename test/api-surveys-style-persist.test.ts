/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('../lib/auth/jwt', () => ({ verifyToken: vi.fn() }));

import { POST as createMemberList } from '../app/api/member-lists/route';
import { POST as createSurvey, GET as getSurveys } from '../app/api/surveys/route';
import { verifyToken } from '../lib/auth/jwt';
import prisma from '../lib/prisma';

describe('Survey creation and persistence', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const admin = await prisma.admin.findUnique({ where: { email: 'admin@hoasurvey.local' } });
    const adminId = admin?.id || 'admin1';
    (verifyToken as any).mockResolvedValue({ adminId });
  });

  it('preserves inline font-size style when creating and fetching survey', async () => {
    // Create a member list
    const memberListReq = new NextRequest('http://localhost/api/member-lists', {
      method: 'POST',
      headers: { cookie: 'auth-token=valid-token' },
    });
    (memberListReq as any).formData = vi.fn().mockResolvedValue({ get: (key: string) => (key === 'name' ? 'Test List' : null) });

    const memberRes = await createMemberList(memberListReq as any);
    expect(memberRes.status).toBe(201);
    const memberBody = await memberRes.json();
    const memberListId = memberBody.id;

    // Create survey directly in DB to avoid API-level complexity in this test
    const description = '<p><span style="font-size:22px">Big text</span></p>';
    const now = new Date();
    const admin = await prisma.admin.findUnique({ where: { email: 'admin@hoasurvey.local' } });
    const createdSurvey = await prisma.survey.create({
      data: {
        title: 'Test Survey',
        description,
        opensAt: now,
        closesAt: new Date(now.getTime() + 3600000),
        memberListId,
        createdById: admin?.id || undefined,
        createdAt: new Date(),
      },
    });
    expect(createdSurvey.id).toBeDefined();

    // Fetch surveys and verify description persists
    const getReq = new NextRequest('http://localhost/api/surveys', {
      method: 'GET',
      headers: { cookie: 'auth-token=valid-token' },
    });
    const listRes = await getSurveys(getReq as any);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    const created = listBody.find((s: any) => s.title === 'Test Survey');
    expect(created).toBeDefined();
    expect(created.description).toContain('font-size');
    expect(created.description).toMatch(/font-size:\s?22px/);
  });
});

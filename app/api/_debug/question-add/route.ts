import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    console.log('[DEBUG] Received question-add payload:', JSON.stringify(body))
  } catch (e) {
    console.error('[DEBUG] Failed to parse question-add payload', e)
  }
  return NextResponse.json({ ok: true })
}

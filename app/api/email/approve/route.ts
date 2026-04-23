import { sendApprovalEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, name } = await request.json()

  try {
    await sendApprovalEmail(email, name)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

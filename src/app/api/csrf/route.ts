import { NextResponse } from 'next/server'
import { getCsrfToken } from '@/lib/csrf'

export async function GET() {
  const token = await getCsrfToken()
  return NextResponse.json({ token })
}

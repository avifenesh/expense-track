import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const timestamp = new Date().toISOString()
  const uptime = Math.floor(process.uptime())

  // Check database connectivity
  const dbCheck = await checkDatabase()

  const status = dbCheck.status === 'up' ? 'healthy' : 'unhealthy'
  const httpStatus = dbCheck.status === 'up' ? 200 : 503

  return NextResponse.json(
    {
      status,
      timestamp,
      checks: {
        database: dbCheck,
      },
      uptime,
    },
    { status: httpStatus },
  )
}

async function checkDatabase() {
  const startTime = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    const responseTime = Math.round(performance.now() - startTime)
    return { status: 'up', responseTime }
  } catch {
    const responseTime = Math.round(performance.now() - startTime)
    return {
      status: 'down',
      responseTime,
      error: 'Database connection failed',
    }
  }
}

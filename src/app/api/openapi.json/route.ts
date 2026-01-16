import { NextResponse } from 'next/server'
import { generateOpenAPIDocument } from '@/lib/openapi/spec'

// Cache the generated document
let cachedDocument: ReturnType<typeof generateOpenAPIDocument> | null = null

export async function GET() {
  // Generate document once and cache it
  if (!cachedDocument) {
    cachedDocument = generateOpenAPIDocument()
  }

  return NextResponse.json(cachedDocument, {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Content-Type': 'application/json',
    },
  })
}

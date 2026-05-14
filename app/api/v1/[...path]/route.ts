import { NextRequest, NextResponse } from 'next/server'

const BACKEND = 'http://localhost:8000'

async function proxy(req: NextRequest): Promise<NextResponse> {
  const destUrl = BACKEND + req.nextUrl.pathname + req.nextUrl.search

  // Forward all headers including Authorization — skip host to avoid conflicts
  const headers = new Headers()
  req.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'host') headers.set(key, value)
  })

  const init: RequestInit = { method: req.method, headers }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const text = await req.text()
    if (text) init.body = text
  }

  const upstream = await fetch(destUrl, init)

  const resHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'transfer-encoding') resHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders })
}

export const GET    = proxy
export const POST   = proxy
export const PUT    = proxy
export const DELETE = proxy
export const PATCH  = proxy

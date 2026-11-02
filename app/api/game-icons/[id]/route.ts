import { fetchGameWebApi } from '../../../server/game-web-api'

const unavailable = (status: number) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } })

export const GET = async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params

  if (id === '.' || id === '..' || /[/\\]/.test(id)) return unavailable(400)
  const sessionId = new URL(request.url).searchParams.get('v')
  const version = sessionId ? `?v=${encodeURIComponent(sessionId)}` : ''

  try {
    const response = await fetchGameWebApi(`/api/v1/icons/${encodeURIComponent(id)}${version}`, AbortSignal.timeout(8_000))

    if (!response.ok) return unavailable(response.status === 404 ? 404 : 502)
    if (!response.headers.get('content-type')?.startsWith('image/png')) return unavailable(502)
    return new Response(response.body, { headers: {
      'Content-Type': 'image/png',
      'Cache-Control': sessionId ? 'private, max-age=86400, immutable' : 'no-store',
    } })
  } catch {
    return unavailable(503)
  }
}

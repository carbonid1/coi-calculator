import 'server-only'

export const gameWebApiUrl = (path: string) => new URL(path, process.env.COI_WEB_API_URL || 'http://127.0.0.1:3073')

export const fetchGameWebApi = (path: string, signal: AbortSignal) => fetch(gameWebApiUrl(path), {
  cache: 'no-store', redirect: 'error', signal,
})

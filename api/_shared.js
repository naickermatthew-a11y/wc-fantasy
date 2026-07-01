// Shared proxy logic for the API-Football serverless routes.
// Underscore-prefixed filename keeps Vercel from treating this as its own route.
const API_BASE = 'https://v3.football.api-sports.io'

export function proxyApiFootball(upstreamPath) {
  return async function handler(req, res) {
    const apiKey = process.env.API_FOOTBALL_KEY
    console.log(`[api-football] ${upstreamPath} | API_FOOTBALL_KEY present:`, !!apiKey, '| prefix:', apiKey?.slice(0, 6) ?? 'n/a')
    if (!apiKey) {
      res.status(500).json({ error: 'API_FOOTBALL_KEY is not configured on the server' })
      return
    }

    const query = new URLSearchParams(req.query).toString()
    const url = `${API_BASE}${upstreamPath}${query ? `?${query}` : ''}`

    try {
      const upstreamRes = await fetch(url, {
        headers: {
          'x-apisports-key': apiKey,
          'x-apisports-host': 'v3.football.api-sports.io',
        },
      })
      const data = await upstreamRes.json()
      res.status(upstreamRes.status).json(data)
    } catch (err) {
      res.status(502).json({ error: 'Upstream API-Football request failed', message: err.message })
    }
  }
}

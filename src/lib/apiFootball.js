// In dev, Vite proxies /api-football → https://v3.football.api-sports.io to avoid CORS.
// In production, call the API directly (deploy behind a server-side proxy or serverless fn).
const BASE_URL = import.meta.env.DEV ? '/api-football' : 'https://v3.football.api-sports.io'

// Confirmed via GET /leagues?name=World+Cup&season=2026 → id:1, current:true
const WC_LEAGUE_ID = 1
const WC_SEASON = 2026

export function isApiFootballConfigured() {
  return !!import.meta.env.VITE_API_FOOTBALL_KEY
}

async function apiFetch(path) {
  const key = import.meta.env.VITE_API_FOOTBALL_KEY
  const url = `${BASE_URL}${path}`
  console.log('[API-Football] GET', url, '| key present:', !!key, '| key prefix:', key?.slice(0, 6))

  const res = await fetch(url, {
    headers: {
      'x-apisports-key': key,
      'x-apisports-host': 'v3.football.api-sports.io',
    },
  })
  console.log('[API-Football] status:', res.status, res.statusText)

  if (!res.ok) throw new Error(`API-Football ${res.status}`)
  const data = await res.json()
  console.log('[API-Football] results:', data.results, '| errors:', JSON.stringify(data.errors))

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(Object.values(data.errors)[0])
  }
  return data.response
}

// ── Status ──────────────────────────────────────────────────────────────────

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

function mapStatus(short) {
  if (LIVE_STATUSES.has(short)) return 'LIVE'
  if (FINISHED_STATUSES.has(short)) return 'FT'
  return 'UPCOMING'
}

// ── Position ─────────────────────────────────────────────────────────────────

function mapPosition(pos) {
  return { G: 'GK', D: 'DEF', M: 'MID', F: 'FWD' }[pos] || 'MID'
}

// ── Country → ISO 3166-1 alpha-2 code (used for flagcdn.com image URLs) ────────
// flagcdn.com uses standard 2-letter codes; UK subdivisions use gb-eng / gb-sct / gb-wls

const COUNTRY_ISO2 = {
  Brazil: 'br', Germany: 'de', Argentina: 'ar', France: 'fr',
  England: 'gb-eng', Spain: 'es', Portugal: 'pt', Netherlands: 'nl',
  USA: 'us', 'United States': 'us', Mexico: 'mx', Japan: 'jp',
  Morocco: 'ma', 'South Africa': 'za', Belgium: 'be', Croatia: 'hr', Uruguay: 'uy',
  Colombia: 'co', Senegal: 'sn', Ghana: 'gh', Cameroon: 'cm',
  Australia: 'au', 'South Korea': 'kr', Korea: 'kr', Denmark: 'dk',
  Serbia: 'rs', Switzerland: 'ch', Poland: 'pl', Ecuador: 'ec',
  Canada: 'ca', Wales: 'gb-wls', Iran: 'ir', Qatar: 'qa',
  'Costa Rica': 'cr', 'Saudi Arabia': 'sa', Tunisia: 'tn',
  "Côte d'Ivoire": 'ci', 'Ivory Coast': 'ci', Nigeria: 'ng',
  Austria: 'at', Turkey: 'tr', Chile: 'cl', Peru: 'pe',
  Hungary: 'hu', Slovakia: 'sk', 'Czech Republic': 'cz', Czechia: 'cz',
  Ukraine: 'ua', Scotland: 'gb-sct', Romania: 'ro',
  Panama: 'pa', Honduras: 'hn', Jamaica: 'jm', Venezuela: 've',
  Paraguay: 'py', Bolivia: 'bo', Algeria: 'dz', Egypt: 'eg',
  Mali: 'ml', 'New Zealand': 'nz', Indonesia: 'id', Iraq: 'iq',
  Jordan: 'jo', Slovenia: 'si', Albania: 'al', Georgia: 'ge',
  Greece: 'gr', Israel: 'il', Iceland: 'is', Finland: 'fi',
  Norway: 'no', Sweden: 'se', 'United Arab Emirates': 'ae', 'Cape Verde': 'cv',
  Mozambique: 'mz', Zambia: 'zm', Zimbabwe: 'zw', Tanzania: 'tz',
  Ethiopia: 'et', Kenya: 'ke', Uganda: 'ug', Angola: 'ao',
  Congo: 'cg', 'DR Congo': 'cd', Gabon: 'ga', Benin: 'bj',
  Libya: 'ly', Sudan: 'sd', Somalia: 'so', Rwanda: 'rw',
  Guatemala: 'gt', 'El Salvador': 'sv', Nicaragua: 'ni', Cuba: 'cu',
  'Trinidad and Tobago': 'tt', Curacao: 'cw', Bahrain: 'bh',
  Oman: 'om', Kuwait: 'kw', Lebanon: 'lb', Syria: 'sy',
  Azerbaijan: 'az', Armenia: 'am', Kazakhstan: 'kz', Uzbekistan: 'uz',
  Thailand: 'th', Vietnam: 'vn', Malaysia: 'my', Philippines: 'ph',
  'China PR': 'cn', China: 'cn', Taiwan: 'tw', 'Hong Kong': 'hk',
  India: 'in', Pakistan: 'pk', Bangladesh: 'bd', 'Sri Lanka': 'lk',
}

function teamFlag(name) {
  return COUNTRY_ISO2[name] || null
}

// API-Football sometimes returns names prefixed with a 2-letter ISO code, e.g. "fr France"
function stripCountryCodePrefix(name) {
  return name.replace(/^[a-z]{2}\s+/, '')
}

// ── AEST time helpers (UTC+10, Queensland — no DST ever) ─────────────────────

const AEST_OFFSET_MS = 10 * 60 * 60 * 1000
const DAYS  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toAEST(isoDate) {
  return new Date(new Date(isoDate).getTime() + AEST_OFFSET_MS)
}

// Returns e.g. "Fri 13 Jun · 8:00 PM AEST"
function formatKickoff(isoDate) {
  const d = toAEST(isoDate)
  const day   = DAYS[d.getUTCDay()]
  const date  = d.getUTCDate()
  const month = MONTHS[d.getUTCMonth()]
  let   h     = d.getUTCHours()
  const m     = String(d.getUTCMinutes()).padStart(2, '0')
  const ampm  = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${day} ${date} ${month} · ${h}:${m} ${ampm} AEST`
}

// ── Public: map fixture object ────────────────────────────────────────────────

export function mapFixture(f) {
  const status = mapStatus(f.fixture.status.short)
  const venueParts = [f.fixture.venue?.name, f.fixture.venue?.city].filter(Boolean)
  const homeName = stripCountryCodePrefix(f.teams.home.name)
  const awayName = stripCountryCodePrefix(f.teams.away.name)
  return {
    id: f.fixture.id,
    home: {
      name: homeName,
      flag: teamFlag(homeName),
      code: f.teams.home.code || homeName.slice(0, 3).toUpperCase(),
    },
    away: {
      name: awayName,
      flag: teamFlag(awayName),
      code: f.teams.away.code || awayName.slice(0, 3).toUpperCase(),
    },
    status,
    minute: f.fixture.status.elapsed || 0,
    homeScore: f.goals.home ?? 0,
    awayScore: f.goals.away ?? 0,
    venue: venueParts.length ? venueParts.join(', ') : 'TBA',
    kickoff: formatKickoff(f.fixture.date),
    date: f.fixture.date,
    isApiMatch: true,
  }
}

// ── Public: fetch live + upcoming WC fixtures ─────────────────────────────────

export async function fetchWCFixtures() {
  // Anchor the date window to AEST "today" so a match that's already kicked off
  // in Brisbane never falls outside the from/to range due to UTC offset.
  const nowAEST = new Date(Date.now() + AEST_OFFSET_MS)
  const from = new Date(nowAEST.getTime() - 86400000).toISOString().slice(0, 10) // yesterday AEST
  const to   = new Date(nowAEST.getTime() + 8 * 86400000).toISOString().slice(0, 10) // +8 days

  console.log('[API-Football] fetchWCFixtures — AEST window:', from, '→', to)

  const [liveRaw, rangeRaw] = await Promise.all([
    apiFetch(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&live=all`),
    apiFetch(`/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}&from=${from}&to=${to}`),
  ])

  console.log('[API-Football] live count:', liveRaw.length, '| range count:', rangeRaw.length)
  console.log('[API-Football] raw range fixtures:', rangeRaw.map(f =>
    `[${f.fixture.id}] ${f.teams.home.name} vs ${f.teams.away.name} | ${f.fixture.status.short} | ${f.fixture.date} | ${f.fixture.venue?.name ?? 'TBA'}`
  ))

  const seen = new Set()
  const result = []
  // Live fixtures first so their real-time status overrides the range snapshot
  for (const f of [...liveRaw, ...rangeRaw]) {
    const id = f.fixture.id
    if (seen.has(id)) continue
    seen.add(id)
    result.push(mapFixture(f))
  }

  // Sort: LIVE → UPCOMING → FT, then by kickoff time within each group
  const ORDER = { LIVE: 0, UPCOMING: 1, FT: 2 }
  result.sort((a, b) => {
    const s = (ORDER[a.status] ?? 1) - (ORDER[b.status] ?? 1)
    return s !== 0 ? s : new Date(a.date) - new Date(b.date)
  })

  console.log('[API-Football] mapped:', result.length, result.map(m => `${m.home.name} vs ${m.away.name} [${m.status}]`))
  return result
}

// ── Public: fetch starting XI for a fixture ───────────────────────────────────

export async function fetchLineup(fixtureId) {
  console.log('[fetchLineup] ── requesting fixture:', fixtureId)

  // Use a raw fetch so we can log the full response body before any processing
  const key = import.meta.env.VITE_API_FOOTBALL_KEY
  const url = `${BASE_URL}/fixtures/lineups?fixture=${fixtureId}`
  const res = await fetch(url, {
    headers: { 'x-apisports-key': key, 'x-apisports-host': 'v3.football.api-sports.io' },
  })
  const json = await res.json()

  console.log('[fetchLineup] ── HTTP status:', res.status)
  console.log('[fetchLineup] ── results count:', json.results)
  console.log('[fetchLineup] ── errors:', JSON.stringify(json.errors))
  console.log('[fetchLineup] ── FULL RAW RESPONSE:', JSON.stringify(json, null, 2))

  const raw = json.response
  if (!raw || raw.length === 0) {
    console.warn('[fetchLineup] ── response array empty — lineups not posted yet (normal before ~60 min to kickoff)')
    return null
  }

  const players = []
  for (const team of raw) {
    console.log(`[fetchLineup] ── team: "${team.team?.name}" | startXI entries: ${team.startXI?.length}`)
    for (const entry of team.startXI) {
      const player = {
        id: `api-${entry.player.id}`,
        name: entry.player.name,
        team: stripCountryCodePrefix(team.team.name),
        position: mapPosition(entry.player.pos),
        number: entry.player.number,
      }
      players.push(player)
    }
  }

  console.log('[fetchLineup] ── mapped', players.length, 'players:',
    players.map(p => `${p.name} (${p.position})`))
  return players.length > 0 ? players : null
}

// ── Public: real-time fixture status (clock + score) ─────────────────────────
// Returns { elapsed, status, homeScore, awayScore } or null on failure.

export async function fetchFixtureStatus(fixtureId) {
  const data = await apiFetch(`/fixtures?id=${fixtureId}`)
  if (!data || data.length === 0) return null
  const f = data[0]
  const elapsed = f.fixture.status.elapsed ?? 0
  const extra   = f.fixture.status.extra  ?? 0
  return {
    elapsed,
    extra,
    // Combined minute used for timers, event ordering, and power-up expiry.
    // During stoppage time: elapsed=90, extra=4 → effectiveMinute=94.
    effectiveMinute: elapsed + extra,
    status: mapStatus(f.fixture.status.short),
    homeScore: f.goals.home ?? 0,
    awayScore: f.goals.away ?? 0,
  }
}

// ── Public: fetch raw events for a live fixture ───────────────────────────────

export async function fetchFixtureEvents(fixtureId) {
  return apiFetch(`/fixtures/events?fixture=${fixtureId}`)
}

// ── Public: fetch per-player stats for cumulative scoring ────────────────────
// Returns { [apiPlayerId]: { name, passes, blocks, interceptions } }
// Used to detect completed-passes batches, shots blocked, and interceptions.

export async function fetchPlayerStats(fixtureId) {
  const data = await apiFetch(`/fixtures/players?fixture=${fixtureId}`)
  const stats = {}
  for (const team of (data || [])) {
    for (const entry of (team.players || [])) {
      const s = entry.statistics?.[0]
      if (!s) continue
      stats[String(entry.player.id)] = {
        name: entry.player.name,
        passes: s.passes?.total ?? 0,
        blocks: s.tackles?.blocks ?? 0,
        interceptions: s.tackles?.interceptions ?? 0,
      }
    }
  }
  console.log(`[fetchPlayerStats] fixture=${fixtureId} → ${Object.keys(stats).length} players`)
  return stats
}

// ── Public: diff player stats → new cumulative stat events ───────────────────
// currentStats / prevStats: result of fetchPlayerStats (prev = {} on first poll)
// draftedPlayers: array of drafted fantasy player objects
// Returns same shape as mapApiEventsToGame: { apiName, player, eventType }[]

export function mapPlayerStatsToEvents(currentStats, prevStats, draftedPlayers) {
  const result = []

  // Reuse the same last-name fallback matcher from mapApiEventsToGame
  function findDrafted(apiId, apiName) {
    const byId = draftedPlayers.find(p => p.id === `api-${apiId}`)
    if (byId) return byId
    if (!apiName) return null
    const apiLast = apiName.trim().split(/\s+/).pop().toLowerCase()
    if (apiLast.length < 3) return null
    return draftedPlayers.find(p => {
      const pLast = p.name.trim().split(/\s+/).pop().toLowerCase()
      return pLast === apiLast
    }) ?? null
  }

  for (const [apiId, cur] of Object.entries(currentStats)) {
    const prev = prevStats[apiId] ?? { passes: 0, blocks: 0, interceptions: 0 }
    const matched = findDrafted(apiId, cur.name)

    // Completed passes — award one batch event per 10-pass threshold crossed
    const prevBatches = Math.floor((prev.passes || 0) / 10)
    const currBatches = Math.floor((cur.passes  || 0) / 10)
    for (let b = prevBatches + 1; b <= currBatches; b++) {
      result.push({ apiName: cur.name, player: matched, eventType: 'completed_passes_batch' })
    }

    // Shots blocked — one event per new block
    const newBlocks = Math.max(0, (cur.blocks || 0) - (prev.blocks || 0))
    for (let i = 0; i < newBlocks; i++) {
      result.push({ apiName: cur.name, player: matched, eventType: 'shot_blocked' })
    }

    // Interceptions — one event per new interception
    const newInts = Math.max(0, (cur.interceptions || 0) - (prev.interceptions || 0))
    for (let i = 0; i < newInts; i++) {
      result.push({ apiName: cur.name, player: matched, eventType: 'interception' })
    }
  }

  if (result.length > 0) {
    console.log(`[mapPlayerStatsToEvents] ${result.length} events (${result.filter(e => e.player).length} owned)`)
  }
  return result
}

// ── Public: map raw API events → game events ──────────────────────────────────
// Returns ALL goal/card events (afterMinute cutoff applied).
// `player` is the matched drafted player or null if nobody drafted that player.
// `apiName` / `apiTeam` are the raw strings from the API for display.
// Callers should insert a ticker row for every event and only award points when player != null.

// strictBoundary=true uses strict < so events at the exact afterMinute boundary
// are not dropped when the API delivers two events at the same minute across polls.
export function mapApiEventsToGame(rawEvents, draftedPlayers, afterMinute = 0, strictBoundary = false) {
  console.log(`[mapApiEventsToGame] rawEvents=${rawEvents?.length ?? 0} drafted=${draftedPlayers?.length ?? 0} afterMinute=${afterMinute} strictBoundary=${strictBoundary}`)

  // Match by API numeric id (prefix 'api-') first, then by last-name as fallback.
  // Hardcoded squad players use ids like 'est-USA-10' so ID match fails for them.
  function findDrafted(apiId, apiName) {
    const byId = draftedPlayers.find(p => p.id === `api-${apiId}`)
    if (byId) return byId
    if (!apiName) return null
    // Abbreviated API names are like "C. Pulisic" — compare last word
    const apiLast = apiName.trim().split(/\s+/).pop().toLowerCase()
    if (apiLast.length < 3) return null
    return draftedPlayers.find(p => {
      const pLast = p.name.trim().split(/\s+/).pop().toLowerCase()
      return pLast === apiLast
    }) ?? null
  }

  const result = []

  for (const event of rawEvents) {
    const elapsed = event.time.elapsed + (event.time.extra || 0)
    if (strictBoundary ? elapsed < afterMinute : elapsed <= afterMinute) continue

    console.log(`[mapApiEventsToGame] +${elapsed}' ${event.type} ${event.detail} | ${event.player?.name} (id:${event.player?.id}) | team: ${event.team?.name}`)

    if (event.type === 'Goal' && (event.detail === 'Normal Goal' || event.detail === 'Penalty')) {
      const matched = findDrafted(event.player?.id, event.player?.name)
      console.log(`  → goal player match: ${matched ? matched.name + ' (' + matched.id + ')' : 'NONE'}`)
      result.push({
        apiName: event.player?.name ?? '?',
        apiTeam: event.team?.name ?? '',
        player: matched,
        eventType: 'goal',
        minute: elapsed,
      })
      if (event.assist?.id || event.assist?.name) {
        const assistMatched = findDrafted(event.assist?.id, event.assist?.name)
        console.log(`  → assist match: ${assistMatched ? assistMatched.name : 'NONE'} (${event.assist?.name})`)
        result.push({
          apiName: event.assist?.name ?? '?',
          apiTeam: event.team?.name ?? '',
          player: assistMatched,
          eventType: 'assist',
          minute: elapsed,
        })
      }
    } else if (event.type === 'Card') {
      const cardType = event.detail === 'Yellow Card' ? 'yellow_card'
        : event.detail === 'Red Card' ? 'red_card' : null
      if (cardType) {
        const matched = findDrafted(event.player?.id, event.player?.name)
        console.log(`  → card match: ${matched ? matched.name : 'NONE'}`)
        result.push({
          apiName: event.player?.name ?? '?',
          apiTeam: event.team?.name ?? '',
          player: matched,
          eventType: cardType,
          minute: elapsed,
        })
      }
    } else if (event.type === 'subst' || event.type === 'Subst') {
      // API-Football: player = subbed OFF, assist = coming ON
      const playerOff = findDrafted(event.player?.id, event.player?.name)
      console.log(`  → sub off match: ${playerOff ? playerOff.name + ' (' + playerOff.id + ')' : 'NONE'} | sub on: ${event.assist?.name} (id:${event.assist?.id})`)
      result.push({
        apiName: event.player?.name ?? '?',
        apiNameOn: event.assist?.name ?? '?',
        apiTeam: event.team?.name ?? '',
        player: playerOff,
        playerOnApiId: event.assist?.id ?? null,
        playerOnApiName: event.assist?.name ?? null,
        eventType: 'substitution',
        minute: elapsed,
      })
    }
  }

  console.log(`[mapApiEventsToGame] → ${result.length} events (${result.filter(e => e.player).length} owned)`)
  return result
}

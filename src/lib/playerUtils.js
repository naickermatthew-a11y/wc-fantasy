import { PLAYERS_BY_MATCH } from '../data/matches'
import { SQUAD_BY_TEAM } from '../data/squads'

// 4-3-3 generic positional placeholders — last resort only
const SQUAD_TEMPLATE = [
  { pos: 'GK',  num: 1,  role: 'Goalkeeper'   },
  { pos: 'DEF', num: 2,  role: 'Right Back'    },
  { pos: 'DEF', num: 5,  role: 'Centre Back'   },
  { pos: 'DEF', num: 6,  role: 'Centre Back'   },
  { pos: 'DEF', num: 3,  role: 'Left Back'     },
  { pos: 'MID', num: 4,  role: 'Defensive Mid' },
  { pos: 'MID', num: 8,  role: 'Central Mid'   },
  { pos: 'MID', num: 10, role: 'Attacking Mid' },
  { pos: 'FWD', num: 7,  role: 'Right Wing'    },
  { pos: 'FWD', num: 9,  role: 'Striker'       },
  { pos: 'FWD', num: 11, role: 'Left Wing'     },
]

// Convert a SQUAD_BY_TEAM array entry into full player objects
export function squadToPlayers(squadArr, teamName, teamCode) {
  return squadArr.map(p => ({
    id: `est-${teamCode || teamName.slice(0, 3).toUpperCase()}-${p.number}`,
    name: p.name,
    team: teamName,
    position: p.position,
    number: p.number,
    isEstSquad: true,
  }))
}

// 4-level cascade — never returns an empty list for a known match.
// Level 1: exact static PLAYERS_BY_MATCH[match.id]
// Level 2: team-name search across all static squads
// Level 3: SQUAD_BY_TEAM hardcoded squad (isEstSquad: true)
// Level 4: generic SQUAD_TEMPLATE positional placeholders (isPlaceholder: true)
export function getFallbackPlayers(match) {
  if (!match) return []

  // 1. Exact match by fixture ID
  const byId = PLAYERS_BY_MATCH[match.id]
  if (byId?.length) return byId

  // 2. Team-name match across all static squads
  const allStatic = Object.values(PLAYERS_BY_MATCH).flat()
  const byTeam = allStatic.filter(
    p => p.team === match.home?.name || p.team === match.away?.name
  )
  if (byTeam.length >= 4) return byTeam

  // 3. Hardcoded estimated squads (works for all 25+ named WC teams)
  const homeSquad = SQUAD_BY_TEAM[match.home?.name]
  const awaySquad = SQUAD_BY_TEAM[match.away?.name]
  if (homeSquad || awaySquad) {
    const players = []
    if (homeSquad) players.push(...squadToPlayers(homeSquad, match.home.name, match.home.code))
    if (awaySquad) players.push(...squadToPlayers(awaySquad, match.away.name, match.away.code))
    if (players.length > 0) {
      console.log('[playerUtils] using hardcoded squads for', match.home?.name, 'vs', match.away?.name, '—', players.length, 'players')
      return players
    }
  }

  // 4. Generic positional placeholders — only if team not in SQUAD_BY_TEAM at all
  console.warn('[playerUtils] no squad data for', match.home?.name, 'vs', match.away?.name, '— using placeholders')
  const players = []
  for (const team of [match.home, match.away]) {
    if (!team) continue
    SQUAD_TEMPLATE.forEach(({ pos, num, role }) => {
      players.push({
        id: `ph-${team.code}-${num}`,
        name: role,
        team: team.name,
        position: pos,
        number: num,
        isPlaceholder: true,
      })
    })
  }
  return players
}

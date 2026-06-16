// Event types and their scoring
export const SCORING = {
  goal:                    { label: 'Goal',                 points: 60  },
  assist:                  { label: 'Assist',               points: 40  },
  clean_sheet:             { label: 'Clean Sheet',          points: 40  },
  shot_on_target:          { label: 'Shot on Target',       points: 10  },
  key_pass:                { label: 'Key Pass',             points: 10  },
  tackle:                  { label: 'Tackle',               points: 10  },
  completed_passes_batch:  { label: '10 Completed Passes',  points: 5   },
  shot_blocked:            { label: 'Shot Blocked',         points: 15  },
  interception:            { label: 'Interception',         points: 15  },
  yellow_card:             { label: 'Yellow Card',          points: -10 },
  red_card:                { label: 'Red Card',             points: -30 },
}

// Weighted random event generation — used in simulation (CPU) mode only.
// Goals/cards/passes/blocks/interceptions come from the live API in real-match mode.
export const EVENT_WEIGHTS = [
  ['shot_on_target',         35],
  ['key_pass',               30],
  ['tackle',                 25],
  ['completed_passes_batch', 20],
  ['interception',           15],
  ['shot_blocked',           12],
  ['goal',                   15],
  ['assist',                 12],
  ['yellow_card',             8],
  ['red_card',                2],
]

// In live API mode: goals/cards come from events endpoint, passes/blocks/interceptions
// from stats endpoint — only simulate minor events that don't have an API equivalent
const LIVE_EVENT_WEIGHTS = [
  ['shot_on_target', 45],
  ['key_pass',       35],
  ['tackle',         20],
]

export function weightedRandom(weights) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [type, w] of weights) {
    r -= w
    if (r <= 0) return type
  }
  return weights[0][0]
}

// liveMode: true when a real API feed is handling goals/cards/stats
export function generateEvent(players, minute, liveMode = false) {
  const eligible = players.filter(p => !p.redCarded)
  if (!eligible.length) return null

  const player = eligible[Math.floor(Math.random() * eligible.length)]
  const weights = liveMode ? LIVE_EVENT_WEIGHTS : EVENT_WEIGHTS
  let eventType = weightedRandom(weights)

  if (!liveMode) {
    const pos = player.position

    // GK/DEF — replace attacking events with defensive equivalents
    if (pos === 'GK' || pos === 'DEF') {
      if (eventType === 'goal')   eventType = 'tackle'
      if (eventType === 'assist') eventType = 'key_pass'
    }
    // FWD — extra chance to score
    if (pos === 'FWD' && Math.random() < 0.3) eventType = 'goal'

    // Shot blocked — only GK/DEF; others reroll to tackle
    if (eventType === 'shot_blocked' && pos !== 'GK' && pos !== 'DEF') {
      eventType = 'tackle'
    }
    // Interception — mostly DEF/MID; GK → tackle, FWD → key_pass
    if (eventType === 'interception') {
      if (pos === 'GK') eventType = 'tackle'
      if (pos === 'FWD') eventType = 'key_pass'
    }
    // Completed passes batch — GK passes less; 50% chance reroll to tackle
    if (eventType === 'completed_passes_batch' && pos === 'GK' && Math.random() < 0.5) {
      eventType = 'tackle'
    }
  }

  const points = SCORING[eventType]?.points ?? 0
  return { player, eventType, points, minute }
}

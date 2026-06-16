export function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function getUserId() {
  let id = localStorage.getItem('wc_fantasy_user_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('wc_fantasy_user_id', id)
  }
  return id
}

export function getDisplayName() {
  return localStorage.getItem('wc_fantasy_display_name') || 'Player'
}

export function setDisplayName(name) {
  localStorage.setItem('wc_fantasy_display_name', name)
}

// Snake draft order for N players, each getting 2 picks.
// e.g. 3 players → [0,1,2, 2,1,0] as indices into sortedPlayers array
export function buildSnakeDraftOrder(playerIds) {
  return [...playerIds, ...[...playerIds].reverse()]
}

// Which player's turn is it at draft pick index i?
export function draftPickOwner(playerIds, pickIndex) {
  const order = buildSnakeDraftOrder(playerIds)
  return order[pickIndex] ?? null
}

export function totalDraftPicks(playerCount) {
  return playerCount * 2
}

// Best available player for auto-pick: prefer FWD/MID, then whoever's first
export function autoPick(availablePlayers) {
  return (
    availablePlayers.find(p => p.position === 'FWD') ||
    availablePlayers.find(p => p.position === 'MID') ||
    availablePlayers[0] ||
    null
  )
}

export const PLAYER_COLORS = ['green', 'yellow', 'purple', 'orange']

export const COLOR_CLASSES = {
  green: {
    border: 'border-green-500/40',
    bg: 'bg-green-950/20',
    text: 'text-green-400',
    badge: 'bg-green-400/10 text-green-400',
  },
  yellow: {
    border: 'border-yellow-500/40',
    bg: 'bg-yellow-950/20',
    text: 'text-yellow-400',
    badge: 'bg-yellow-400/10 text-yellow-400',
  },
  purple: {
    border: 'border-purple-500/40',
    bg: 'bg-purple-950/20',
    text: 'text-purple-400',
    badge: 'bg-purple-400/10 text-purple-400',
  },
  orange: {
    border: 'border-orange-500/40',
    bg: 'bg-orange-950/20',
    text: 'text-orange-400',
    badge: 'bg-orange-400/10 text-orange-400',
  },
}

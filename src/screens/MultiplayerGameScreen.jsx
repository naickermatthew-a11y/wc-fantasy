import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { SCORING } from '../data/events'
import { PLAYER_COLORS, COLOR_CLASSES } from '../lib/roomUtils'
import { fetchFixtureStatus, fetchFixtureEvents, mapApiEventsToGame, fetchPlayerStats, mapPlayerStatsToEvents } from '../lib/apiFootball'
import { getFallbackPlayers } from '../lib/playerUtils'
import CaptainBadge from '../components/CaptainBadge'
import FlagImg from '../components/FlagImg'

const POLL_MS = 60000

export default function MultiplayerGameScreen({ roomInfo, room: initialRoom, players: initialPlayers, match, onEnd }) {
  const { code, userId, isHost } = roomInfo

  const [room, setRoom] = useState(initialRoom)
  const [players, setPlayers] = useState(initialPlayers)
  const [ticker, setTicker] = useState([])
  const [localGS, setLocalGS] = useState(initialRoom.game_state || {})
  const [wsStatus, setWsStatus] = useState('connecting') // 'connected' | 'reconnecting' | 'failed'

  const gsRef = useRef(localGS)         // latest game_state for host event computation
  const playersRef = useRef(players)    // latest player picks for host
  const minuteRef = useRef(localGS.minute ?? 1)
  const gameOverRef = useRef(false)
  const lastApiMinuteRef = useRef(0)
  const lastPlayerStatsRef = useRef({})   // cumulative player stats from previous poll
  const statsInitializedRef = useRef(false) // first successful stats poll sets baseline, not events

  gsRef.current = localGS
  playersRef.current = players

  // If the match prop is missing team names (non-host who joined from a different match),
  // recover display data from the matchData stored in the room's game_state by the host.
  const storedMD = localGS.matchData || initialRoom.game_state?.matchData
  const effectiveMatch = match?.home?.name
    ? match
    : storedMD
      ? { id: initialRoom.match_id, isApiMatch: true, homeScore: 0, awayScore: 0, ...storedMD }
      : match

  console.log('[MultiplayerGame] match prop:', JSON.stringify(match))
  console.log('[MultiplayerGame] effectiveMatch:', JSON.stringify(effectiveMatch))

  // Full squad list used for Wildcard available-player pool.
  // Never empty — falls back to hardcoded estimated squads.
  const allFantasyPlayers = effectiveMatch ? getFallbackPlayers(effectiveMatch) : []

  // Build a map: fantasyPlayerId → ownerUserId
  function buildOwnerMap(pls) {
    const map = {}
    pls.forEach(p => {
      ;(p.picks || []).forEach(fp => { map[fp.id] = p.user_id })
    })
    return map
  }

  // ── Realtime subscriptions with auto-reconnect ─────────────────────────
  useEffect(() => {
    let ch = null
    let reconnectTimer = null
    let cancelled = false
    const reconnectCountRef = { current: 0 }
    const MAX_RECONNECTS = 10
    const RECONNECT_MS = 5000

    function attach() {
      if (ch) supabase.removeChannel(ch)

      ch = supabase
        .channel(`game-${code}-r${reconnectCountRef.current}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
          payload => {
            const r = payload.new
            setRoom(r)
            const gs = r.game_state || {}
            setLocalGS(gs)
            gsRef.current = gs
            minuteRef.current = gs.minute ?? 1
            if (gs.gameOver && !gameOverRef.current) {
              gameOverRef.current = true
            }
          })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticker_events', filter: `room_code=eq.${code}` },
          payload => {
            const e = payload.new
            // Deduplicate: same player + event type + minute is the same real-world event
            const key = `${e.fantasy_player_id ?? e.fantasy_player_name}:${e.event_type}:${e.minute}`
            setTicker(prev => {
              const alreadyIn = prev.some(t =>
                `${t.fantasy_player_id ?? t.fantasy_player_name}:${t.event_type}:${t.minute}` === key
              )
              return alreadyIn ? prev : [e, ...prev].slice(0, 40)
            })
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_code=eq.${code}` },
          async () => {
            const { data } = await supabase.from('room_players').select('*').eq('room_code', code).order('pick_order')
            if (data) {
              setPlayers(data)
              playersRef.current = data
            }
          })
        .subscribe((status) => {
          if (cancelled) return
          if (status === 'SUBSCRIBED') {
            setWsStatus('connected')
            reconnectCountRef.current = 0
            console.log('[MultiplayerGame] WebSocket connected')
          } else if (['TIMED_OUT', 'CLOSED', 'CHANNEL_ERROR'].includes(status)) {
            console.warn('[MultiplayerGame] WebSocket', status, '— attempt', reconnectCountRef.current + 1, '/', MAX_RECONNECTS)
            if (reconnectCountRef.current < MAX_RECONNECTS) {
              setWsStatus('reconnecting')
              reconnectCountRef.current++
              reconnectTimer = setTimeout(attach, RECONNECT_MS)
            } else {
              setWsStatus('failed')
            }
          }
        })
    }

    attach()

    // Load initial ticker (deduplicate by player+event+minute)
    supabase.from('ticker_events').select('*').eq('room_code', code).order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => {
        if (!data) return
        const seen = new Set()
        const deduped = data.filter(e => {
          const key = `${e.fantasy_player_id ?? e.fantasy_player_name}:${e.event_type}:${e.minute}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setTicker(deduped)
      })

    return () => {
      cancelled = true
      clearTimeout(reconnectTimer)
      if (ch) supabase.removeChannel(ch)
    }
  }, [code])

  // ── Host-only: poll real clock + real events every 60 s ───────────────
  // No simulation — points only move when the API reports a real event.
  useEffect(() => {
    if (!isHost || !effectiveMatch?.isApiMatch) return

    const poll = async () => {
      if (gameOverRef.current) return
      try {
        // 1. Update match clock from API
        const status = await fetchFixtureStatus(effectiveMatch.id)
        console.log('[poll] fetchFixtureStatus:', status)
        if (status) {
          minuteRef.current = status.elapsed
          const gs = gsRef.current
          const updatedGS = { ...gs, minute: status.elapsed, homeScore: status.homeScore, awayScore: status.awayScore }

          // Expire power-up timers
          if (gs.doubleDownActive && status.elapsed >= gs.doubleDownActive.endsAtMinute) {
            updatedGS.doubleDownActive = null
            await insertSystemEvent(code, status.elapsed, '⚡ Double Down expired.')
          }
          if (gs.freezeActive && status.elapsed >= gs.freezeActive.endsAtMinute) {
            updatedGS.freezeActive = null
            await insertSystemEvent(code, status.elapsed, '🧊 Freeze expired.')
          }

          // End game when API reports full time
          if (status.status === 'FT' && !gameOverRef.current) {
            updatedGS.gameOver = true
            gameOverRef.current = true
            await supabase.from('rooms').update({ status: 'finished', game_state: updatedGS }).eq('code', code)
            return
          }

          // Update local display immediately (don't wait for real-time echo)
          setLocalGS(updatedGS)
          gsRef.current = updatedGS
          const { error: clockErr } = await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)
          if (clockErr) console.error('[poll] rooms clock update error:', JSON.stringify(clockErr))
        }

        // 2. Fetch and award real match events (goals, cards)
        const rawEvents = await fetchFixtureEvents(effectiveMatch.id)
        const allDrafted = playersRef.current.flatMap(p => p.picks || [])
        const newEvents = mapApiEventsToGame(rawEvents, allDrafted, lastApiMinuteRef.current)
        for (const { apiName, player, eventType } of newEvents) {
          await fireEvent(apiName, player, eventType)
        }
        if (newEvents.length > 0) {
          lastApiMinuteRef.current = Math.max(lastApiMinuteRef.current, ...newEvents.map(e => e.minute))
        }

        // 3. Fetch and award cumulative player stats (passes, shots blocked, interceptions)
        const rawStats = await fetchPlayerStats(effectiveMatch.id)
        if (Object.keys(rawStats).length > 0) {
          if (!statsInitializedRef.current) {
            // First successful stats poll: store as baseline without awarding anything.
            // This prevents retroactively awarding stats accumulated before this session.
            console.log('[poll] player stats baseline set —', Object.keys(rawStats).length, 'players')
            lastPlayerStatsRef.current = rawStats
            statsInitializedRef.current = true
          } else {
            const statEvents = mapPlayerStatsToEvents(rawStats, lastPlayerStatsRef.current, allDrafted)
            for (const { apiName, player, eventType } of statEvents) {
              await fireEvent(apiName, player, eventType)
            }
            lastPlayerStatsRef.current = rawStats
          }
        }
      } catch (err) {
        console.warn('[MultiplayerGame] API poll failed:', err.message)
      }
    }

    poll()
    const interval = setInterval(poll, POLL_MS)
    return () => clearInterval(interval)
  }, [isHost, effectiveMatch?.id])

  // Called for ALL real API events — owned or not.
  // apiName: raw player name from API ("C. Pulisic"), used when no drafted player matched.
  // matchedPlayer: drafted player object or null if nobody drafted this API player.
  async function fireEvent(apiName, matchedPlayer, eventType) {
    const gs = gsRef.current
    const pls = playersRef.current
    const currentMinute = minuteRef.current
    const ownerMap = buildOwnerMap(pls)

    const points = SCORING[eventType]?.points ?? 0
    const ownerUserId = matchedPlayer ? (ownerMap[matchedPlayer.id] ?? null) : null
    const displayName = matchedPlayer?.name ?? apiName

    const isFrozen = !!(matchedPlayer && ownerUserId && gs.freezeActive &&
      gs.freezeActive.playerId === matchedPlayer.id &&
      currentMinute < gs.freezeActive.endsAtMinute)

    const isDoubled = !!(matchedPlayer && ownerUserId && gs.doubleDownActive &&
      gs.doubleDownActive.playerId === matchedPlayer.id &&
      gs.doubleDownActive.ownerUserId === ownerUserId &&
      currentMinute < gs.doubleDownActive.endsAtMinute)

    const ownerRow = ownerUserId ? pls.find(p => p.user_id === ownerUserId) : null
    const isCaptain = !!(ownerRow && matchedPlayer && ownerRow.picks?.[0]?.id === matchedPlayer.id)

    let effectivePoints = 0
    if (ownerUserId && !isFrozen) {
      effectivePoints = points
      if (isCaptain) effectivePoints = Math.round(effectivePoints * 1.5)
      if (isDoubled) effectivePoints *= 2
    }

    // Insert ticker row for every event — unowned shows as a match event (no fantasy points)
    const { error: tickerErr } = await supabase.from('ticker_events').insert({
      room_code: code,
      minute: currentMinute,
      event_type: eventType,
      fantasy_player_name: displayName,
      fantasy_player_id: matchedPlayer?.id ?? null,
      points: effectivePoints,
      owner_user_id: ownerUserId,
      is_frozen: isFrozen,
      is_doubled: isDoubled && !isFrozen,
      is_captain: isCaptain && !isFrozen,
    })
    if (tickerErr) {
      console.error('[fireEvent] ticker_events insert error:', JSON.stringify(tickerErr))
    }

    // Update fantasy scores only when an owned player earned points
    if (ownerUserId && !isFrozen && effectivePoints !== 0) {
      const scores = { ...(gs.scores || {}) }
      scores[ownerUserId] = (scores[ownerUserId] || 0) + effectivePoints

      const playerPoints = { ...(gs.playerPoints || {}) }
      playerPoints[matchedPlayer.id] = [
        ...(playerPoints[matchedPlayer.id] || []),
        { eventType, points: effectivePoints, minute: currentMinute },
      ]

      const updatedGS = { ...gs, scores, playerPoints }
      setLocalGS(updatedGS)
      gsRef.current = updatedGS
      const { error: gsErr } = await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)
      if (gsErr) console.error('[fireEvent] rooms scores update error:', JSON.stringify(gsErr))
    }
  }

  // ── Power-ups (any player can activate) ────────────────────────────────
  async function activateDoubleDown(fantasyPlayer) {
    const gs = gsRef.current
    const updatedGS = {
      ...gs,
      doubleDownActive: {
        playerId: fantasyPlayer.id,
        ownerUserId: userId,
        endsAtMinute: (gs.minute ?? 1) + 10,
      },
      powerups: {
        ...gs.powerups,
        [userId]: { ...(gs.powerups?.[userId] || {}), doubleDown: true },
      },
    }
    await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)
    await supabase.from('room_players').update({
      powerups: { ...(myPlayer?.powerups || {}), doubleDown: true },
    }).eq('room_code', code).eq('user_id', userId)
    await insertSystemEvent(code, gs.minute ?? 1, `⚡ Double Down on ${fantasyPlayer.name} for 10 minutes!`)
    setDoubleDownModal(false)
  }

  async function activateFreeze(fantasyPlayer) {
    const gs = gsRef.current
    const myScore = gs.scores?.[userId] ?? 0
    if (myScore < 50) return

    const updatedGS = {
      ...gs,
      scores: { ...gs.scores, [userId]: myScore - 50 },
      freezeActive: {
        playerId: fantasyPlayer.id,
        endsAtMinute: (gs.minute ?? 1) + 10,
        frozenBy: userId,
      },
      powerups: {
        ...gs.powerups,
        [userId]: { ...(gs.powerups?.[userId] || {}), freeze: true },
      },
    }
    await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)
    await supabase.from('room_players').update({
      powerups: { ...(myPlayer?.powerups || {}), freeze: true },
    }).eq('room_code', code).eq('user_id', userId)
    await insertSystemEvent(code, gs.minute ?? 1, `🧊 ${fantasyPlayer.name} frozen for 10 minutes! (−50 pts)`)
    setFreezeModal(false)
  }

  async function activateWildcard(oldPlayer, newPlayer) {
    const gs = gsRef.current
    const updatedGS = {
      ...gs,
      powerups: {
        ...gs.powerups,
        [userId]: { ...(gs.powerups?.[userId] || {}), wildcard: true },
      },
    }
    await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)

    const myRow = players.find(p => p.user_id === userId)
    if (myRow) {
      const newPicks = (myRow.picks || []).map(p => p.id === oldPlayer.id ? newPlayer : p)
      await supabase.from('room_players').update({
        picks: newPicks,
        powerups: { ...(myRow.powerups || {}), wildcard: true },
      }).eq('room_code', code).eq('user_id', userId)
    }
    await insertSystemEvent(code, gs.minute ?? 1, `🔄 Wildcard: ${oldPlayer.name} → ${newPlayer.name}!`)
    setWildcardModal(false)
  }

  // ── Modal state ─────────────────────────────────────────────────────────
  const [doubleDownModal, setDoubleDownModal] = useState(false)
  const [freezeModal, setFreezeModal] = useState(false)
  const [wildcardModal, setWildcardModal] = useState(false)

  const myPlayer = players.find(p => p.user_id === userId)
  const myPowerups = localGS.powerups?.[userId] || {}
  const myScore = localGS.scores?.[userId] ?? 0
  const myPicks = myPlayer?.picks || []

  const draftedIds = new Set(players.flatMap(p => (p.picks || []).map(fp => fp.id)))
  const available = allFantasyPlayers.filter(p => !draftedIds.has(p.id))

  // All opponent fantasy players (for freeze target)
  const opponentFantasyPlayers = players
    .filter(p => p.user_id !== userId)
    .flatMap(p => p.picks || [])

  const minute = localGS.minute ?? 1
  const gameOver = localGS.gameOver ?? false
  const doubleDownActive = localGS.doubleDownActive
  const freezeActive = localGS.freezeActive

  useEffect(() => {
    if (gameOver) {
      setTimeout(() => onEnd({ room, players, gameState: localGS, ticker }), 1500)
    }
  }, [gameOver])

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* WebSocket status indicator */}
      {wsStatus === 'reconnecting' && (
        <div className="fixed top-3 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="flex items-center gap-2 bg-yellow-950/95 border border-yellow-500/50 text-yellow-300 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
            Reconnecting…
          </div>
        </div>
      )}
      {wsStatus === 'failed' && (
        <div className="fixed top-3 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <div className="bg-red-950/95 border border-red-500/50 text-red-300 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
            Connection lost — please refresh
          </div>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-3">
        {/* Team names + flags + live score */}
        <div className="flex items-center justify-center gap-2 mb-1">
          {/* Home team */}
          <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
            <span className="text-white text-sm font-bold truncate">{effectiveMatch?.home?.name ?? '?'}</span>
            {effectiveMatch?.home?.flag && <FlagImg code={effectiveMatch.home.flag} name={effectiveMatch.home.name} size="md" />}
          </div>
          {/* Score */}
          <div className="flex-shrink-0 px-2">
            <span className="font-orbitron text-xl font-black text-white">
              {localGS.homeScore ?? effectiveMatch?.homeScore ?? 0}–{localGS.awayScore ?? effectiveMatch?.awayScore ?? 0}
            </span>
          </div>
          {/* Away team */}
          <div className="flex items-center gap-1.5 flex-1 justify-start min-w-0">
            {effectiveMatch?.away?.flag && <FlagImg code={effectiveMatch.away.flag} name={effectiveMatch.away.name} size="md" />}
            <span className="text-white text-sm font-bold truncate">{effectiveMatch?.away?.name ?? '?'}</span>
          </div>
        </div>
        {/* Minute / status */}
        <div className="flex items-center justify-center gap-2">
          {gameOver ? (
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">FULL TIME</span>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="text-green-400 font-bold text-sm">{minute}'</span>
            </>
          )}
        </div>
      </div>

      {/* Scores row — all players */}
      <div className={`grid gap-1.5 mb-3 ${players.length <= 2 ? 'grid-cols-2' : players.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
        {players.map((p, i) => {
          const color = PLAYER_COLORS[i] || 'green'
          const cls = COLOR_CLASSES[color]
          const score = localGS.scores?.[p.user_id] ?? 0
          return (
            <div key={p.id} className={`rounded-xl border ${cls.border} ${cls.bg} py-2 text-center`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide truncate px-1 ${cls.text}`}>
                {p.user_id === userId ? 'You' : p.display_name}
              </p>
              <p className={`text-2xl font-black ${cls.text}`}>{score}</p>
              <p className="text-green-700 text-[9px]">pts</p>
            </div>
          )
        })}
      </div>

      {/* My players + power-ups */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] p-3 mb-3">
        <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-2">Your Players</p>
        <div className="space-y-1.5 mb-3">
          {myPicks.map((fp, pickIdx) => {
            const events = localGS.playerPoints?.[fp.id] || []
            const pts = events.reduce((s, e) => s + e.points, 0)
            const isDoubled = doubleDownActive?.playerId === fp.id
            const isFrozen = freezeActive?.playerId === fp.id
            const isCaptain = pickIdx === 0
            const ddRemaining = isDoubled ? Math.max(0, doubleDownActive.endsAtMinute - minute) : 0
            const frRemaining = isFrozen ? Math.max(0, freezeActive.endsAtMinute - minute) : 0
            return (
              <div key={fp.id} className={`rounded-lg border px-2.5 py-2 text-xs ${
                isFrozen ? 'border-blue-500/40 bg-blue-950/20' :
                isDoubled ? 'border-yellow-400/50 bg-yellow-950/20' :
                isCaptain ? 'border-yellow-500/30 bg-yellow-950/10' :
                'border-green-500/20 bg-green-950/10'
              }`}>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    {isCaptain && <CaptainBadge size="sm" />}
                    <span className="font-semibold text-green-100 truncate">{fp.name}</span>
                  </div>
                  <span className={`font-black flex-shrink-0 ${pts >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pts > 0 ? '+' : ''}{pts}</span>
                </div>
                <div className="flex items-center gap-1 flex-wrap mt-0.5">
                  <span className="text-green-700">{fp.position}</span>
                  {isCaptain && <span className="text-yellow-500 text-[10px]">1.5×</span>}
                  {isDoubled && ddRemaining > 0 && (
                    <span className="text-yellow-300 text-[10px] font-bold bg-yellow-900/40 px-1.5 py-0.5 rounded-full">🔥 {ddRemaining} min left</span>
                  )}
                  {isFrozen && frRemaining > 0 && (
                    <span className="text-blue-300 text-[10px] font-bold bg-blue-900/40 px-1.5 py-0.5 rounded-full">❄️ {frRemaining} min left</span>
                  )}
                </div>
                {events.map((ev, i) => (
                  <div key={i} className={`text-[10px] mt-0.5 ${ev.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {ev.minute}' {SCORING[ev.eventType]?.label} {ev.points > 0 ? '+' : ''}{ev.points}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Power-up buttons */}
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => setDoubleDownModal(true)}
            disabled={myPowerups.doubleDown}
            className="py-1.5 rounded-lg text-[10px] font-bold border border-yellow-500/30 text-yellow-400 hover:bg-yellow-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {myPowerups.doubleDown ? '⚡ Used' : '⚡ 2×'}
          </button>
          <button
            onClick={() => setWildcardModal(true)}
            disabled={myPowerups.wildcard}
            className="py-1.5 rounded-lg text-[10px] font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {myPowerups.wildcard ? '🔄 Used' : '🔄 Swap'}
          </button>
          <button
            onClick={() => setFreezeModal(true)}
            disabled={myPowerups.freeze || myScore < 50}
            className={`py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
              myPowerups.freeze ? 'border-blue-500/20 text-blue-700 opacity-30 cursor-not-allowed' :
              myScore < 50 ? 'border-blue-500/20 text-blue-700 cursor-not-allowed' :
              'border-blue-500/30 text-blue-400 hover:bg-blue-950/20'
            }`}
          >
            {myPowerups.freeze ? '🧊 Used' : myScore < 50 ? '🧊 −50' : '🧊 −50'}
          </button>
        </div>
      </div>

      {/* Opponents' players (compact) */}
      {players.filter(p => p.user_id !== userId).map((p, i) => {
        const color = PLAYER_COLORS[i + 1] || 'yellow'
        const cls = COLOR_CLASSES[color]
        return (
          <div key={p.id} className="rounded-2xl border border-[#1e2b25] bg-[#111815] p-3 mb-3">
            <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${cls.text}`}>{p.display_name}</p>
            <div className="space-y-1">
              {(p.picks || []).map(fp => {
                const pts = (localGS.playerPoints?.[fp.id] || []).reduce((s, e) => s + e.points, 0)
                const isFrozen = freezeActive?.playerId === fp.id
                const frRemaining = isFrozen ? Math.max(0, freezeActive.endsAtMinute - minute) : 0
                return (
                  <div key={fp.id} className={`rounded-lg border px-2 py-1.5 text-xs ${isFrozen ? 'border-blue-500/30 bg-blue-950/10' : cls.border + ' ' + cls.bg}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-green-100 truncate max-w-[100px]">{fp.name}</span>
                      <div className="flex items-center gap-1.5">
                        {isFrozen && frRemaining > 0 && (
                          <span className="text-blue-300 text-[10px] font-bold bg-blue-900/40 px-1 py-0.5 rounded-full">❄️ {frRemaining}m</span>
                        )}
                        <span className={`font-black ${pts >= 0 ? cls.text : 'text-red-400'}`}>{pts > 0 ? '+' : ''}{pts}</span>
                      </div>
                    </div>
                    <span className="text-green-700 text-[10px]">{fp.position}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Ticker */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1e2b25] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Live Feed</span>
        </div>
        <div className="max-h-44 overflow-y-auto scrollbar-hide divide-y divide-[#1e2b25]">
          {ticker.length === 0 && <p className="text-green-800 text-xs text-center py-5">Waiting for events…</p>}
          {ticker.map(e => <MultiTickerRow key={e.id} entry={e} players={players} userId={userId} />)}
        </div>
      </div>

      {gameOver && (
        <div className="mt-4 text-center rounded-xl bg-green-950/30 border border-green-500/30 py-3 px-4">
          <p className="font-black text-xl text-green-400">Full Time! Loading results…</p>
        </div>
      )}

      {/* Modals */}
      {doubleDownModal && (
        <DoubleDownModal
          players={myPicks}
          playerPoints={localGS.playerPoints}
          onConfirm={activateDoubleDown}
          onCancel={() => setDoubleDownModal(false)}
        />
      )}
      {freezeModal && (
        <FreezeModal
          players={opponentFantasyPlayers}
          playerPoints={localGS.playerPoints}
          playersInfo={players}
          onConfirm={activateFreeze}
          onCancel={() => setFreezeModal(false)}
        />
      )}
      {wildcardModal && (
        <WildcardModal
          myPicks={myPicks}
          available={available}
          onConfirm={activateWildcard}
          onCancel={() => setWildcardModal(false)}
        />
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function insertSystemEvent(code, minute, message) {
  await supabase.from('ticker_events').insert({
    room_code: code,
    minute,
    is_system: true,
    message,
    points: 0,
  })
}

function MultiTickerRow({ entry, players, userId }) {
  if (entry.is_system) {
    return (
      <div className="px-4 py-2 bg-green-950/20">
        <p className="text-xs text-green-300 font-medium">{entry.message}</p>
      </div>
    )
  }

  const hasOwner = !!entry.owner_user_id
  const ownerName = !hasOwner ? null
    : entry.owner_user_id === userId ? 'You'
    : players.find(p => p.user_id === entry.owner_user_id)?.display_name ?? '?'

  const pts = entry.points
  const color = pts > 0 ? 'text-green-400' : pts < 0 ? 'text-red-400' : 'text-green-700'
  const label = SCORING[entry.event_type]?.label || entry.event_type

  return (
    <div className="px-4 py-2 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-green-700 text-xs mr-1">{entry.minute}'</span>
        <span className={`text-xs font-semibold ${hasOwner ? 'text-green-100' : 'text-green-500'}`}>
          {entry.fantasy_player_name}
        </span>
        <span className="text-green-600 text-xs mx-1">·</span>
        <span className="text-green-500 text-xs">{label}</span>
        {entry.is_captain && <span className="text-yellow-400 text-xs ml-1">© 1.5×</span>}
        {entry.is_frozen && <span className="text-blue-400 text-xs ml-1">❄️</span>}
        {entry.is_doubled && <span className="text-yellow-400 text-xs ml-1">⚡2×</span>}
        {ownerName && <span className="text-green-700 text-[10px] ml-1">({ownerName})</span>}
        {!hasOwner && <span className="text-green-800 text-[10px] ml-1">· match event</span>}
      </div>
      {hasOwner ? (
        <span className={`text-xs font-black flex-shrink-0 ${color}`}>
          {pts > 0 ? '+' : ''}{entry.is_frozen ? '0' : pts}
        </span>
      ) : (
        <span className="text-green-800 text-xs">—</span>
      )}
    </div>
  )
}

// ── Power-up Modals ──────────────────────────────────────────────────────────

function DoubleDownModal({ players, playerPoints, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-yellow-500/40 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚡</span>
          <h3 className="font-black text-yellow-400 text-lg">Double Down</h3>
        </div>
        <p className="text-green-600 text-xs mb-5">Choose a player to double for 10 minutes.</p>
        <div className="space-y-2 mb-5">
          {players.map(p => {
            const pts = (playerPoints?.[p.id] || []).reduce((s, e) => s + e.points, 0)
            return (
              <button key={p.id} onClick={() => onConfirm(p)}
                className="w-full flex items-center justify-between rounded-xl border border-[#1e2b25] bg-[#0a0f0d] px-4 py-3 hover:border-yellow-500/60 hover:bg-yellow-950/10 transition-all group">
                <div className="text-left">
                  <p className="font-bold text-sm text-green-100 group-hover:text-yellow-200 transition-colors">{p.name}</p>
                  <p className="text-green-600 text-xs">{p.team} · {p.position}</p>
                </div>
                <p className={`font-black text-lg ${pts >= 0 ? 'text-green-400' : 'text-red-400'}`}>{pts > 0 ? '+' : ''}{pts}</p>
              </button>
            )
          })}
        </div>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm hover:text-green-400 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function FreezeModal({ players, playerPoints, playersInfo, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-blue-500/40 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🧊</span>
          <h3 className="font-black text-blue-400 text-lg">Freeze</h3>
        </div>
        <p className="text-green-600 text-xs mb-5">Choose an opponent's player to freeze for 10 min. Costs <span className="text-blue-400 font-bold">50 pts</span>.</p>
        <div className="space-y-2 mb-5">
          {players.map(p => {
            const pts = (playerPoints?.[p.id] || []).reduce((s, e) => s + e.points, 0)
            return (
              <button key={p.id} onClick={() => onConfirm(p)}
                className="w-full flex items-center justify-between rounded-xl border border-[#1e2b25] bg-[#0a0f0d] px-4 py-3 hover:border-blue-500/60 hover:bg-blue-950/10 transition-all group">
                <div className="text-left">
                  <p className="font-bold text-sm text-green-100 group-hover:text-blue-200 transition-colors">{p.name}</p>
                  <p className="text-green-600 text-xs">{p.team} · {p.position}</p>
                </div>
                <p className={`font-black text-lg ${pts >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>{pts > 0 ? '+' : ''}{pts}</p>
              </button>
            )
          })}
          {players.length === 0 && <p className="text-green-800 text-xs text-center py-4">No opponent players to freeze</p>}
        </div>
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm hover:text-green-400 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

function WildcardModal({ myPicks, available, onConfirm, onCancel }) {
  const [selectedOld, setSelectedOld] = useState(null)
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-purple-500/30 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔄</span>
          <h3 className="font-black text-purple-400 text-lg">Wildcard</h3>
        </div>
        <p className="text-green-600 text-xs mb-4">Swap one of your players for an undrafted player.</p>
        <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">Your Players</p>
        <div className="space-y-1.5 mb-4">
          {myPicks.map(p => (
            <button key={p.id} onClick={() => setSelectedOld(p)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedOld?.id === p.id ? 'border-purple-400 bg-purple-900/20 text-purple-200' : 'border-[#1e2b25] text-green-300 hover:border-purple-700'
              }`}>
              {p.name} · <span className="text-green-600 text-xs">{p.position}</span>
            </button>
          ))}
        </div>
        {selectedOld && (
          <>
            <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">Replace with</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-hide mb-4">
              {available.length === 0 && <p className="text-green-800 text-xs">No players available</p>}
              {available.map(p => (
                <button key={p.id} onClick={() => onConfirm(selectedOld, p)}
                  className="w-full text-left rounded-lg border border-[#1e2b25] px-3 py-2 text-sm text-green-300 hover:border-purple-500 hover:bg-purple-950/10 transition-colors">
                  {p.name} · <span className="text-green-600 text-xs">{p.team} · {p.position}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <button onClick={onCancel} className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm hover:text-green-400 transition-colors">Cancel</button>
      </div>
    </div>
  )
}

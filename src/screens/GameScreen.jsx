import { useState, useEffect, useRef } from 'react'
import { PLAYERS_BY_MATCH } from '../data/matches'
import { SCORING, generateEvent } from '../data/events'
import { fetchFixtureEvents, mapApiEventsToGame, fetchPlayerStats, mapPlayerStatsToEvents } from '../lib/apiFootball'
import CaptainBadge from '../components/CaptainBadge'

const MATCH_DURATION = 90
const EVENT_INTERVAL_MS = 25000
const LIVE_POLL_MS = 60000

export default function GameScreen({ match, picks, allMatchPlayers, onEnd }) {
  const allPlayers = allMatchPlayers || PLAYERS_BY_MATCH[match.id] || []
  const isLiveApiMode = !!(match.isApiMatch && match.status === 'LIVE')

  const [minute, setMinute] = useState(match.status === 'LIVE' ? match.minute || 1 : 1)
  const [ticker, setTicker] = useState([])
  const [scores, setScores] = useState({ player: 0, cpu: 0 })
  const [playerPoints, setPlayerPoints] = useState(() => {
    const init = {}
    allPlayers.forEach(p => { init[p.id] = [] })
    return init
  })

  const [powerups, setPowerups] = useState({
    player: { doubleDown: false, wildcard: false, freeze: false },
    cpu: { doubleDown: false, wildcard: false, freeze: false },
  })

  // { playerId, owner, endsAtMinute } — null when inactive or expired
  const [doubleDownActive, setDoubleDownActive] = useState(null)
  // { playerId, endsAtMinute, frozenBy } — null when inactive or expired
  const [freezeActive, setFreezeActive] = useState(null)

  // Modal visibility
  const [doubleDownModal, setDoubleDownModal] = useState(false)
  const [freezeModal, setFreezeModal] = useState(false)
  const [wildcardState, setWildcardState] = useState({ open: false })

  const [effectivePicks, setEffectivePicks] = useState({ player: picks.player, cpu: picks.cpu })
  const [gameOver, setGameOver] = useState(false)

  // Arcade animations
  const [goalFlash, setGoalFlash] = useState({})
  const [floatingPoints, setFloatingPoints] = useState([])
  const [screenFlash, setScreenFlash] = useState(null)
  const [showGameOver, setShowGameOver] = useState(false)

  const minuteRef = useRef(minute)
  minuteRef.current = minute
  const tickerRef = useRef(null)
  const clockRef = useRef(null)

  // Stale-closure-safe refs for onEnd
  const scoresRef = useRef(scores)
  const tickerStateRef = useRef(ticker)
  const playerPointsRef = useRef(playerPoints)
  scoresRef.current = scores
  tickerStateRef.current = ticker
  playerPointsRef.current = playerPoints

  // Also keep doubleDownActive/freezeActive in refs for fireEvent closure
  const doubleDownRef = useRef(doubleDownActive)
  const freezeRef = useRef(freezeActive)
  doubleDownRef.current = doubleDownActive
  freezeRef.current = freezeActive

  const effectivePicksRef = useRef(effectivePicks)
  effectivePicksRef.current = effectivePicks
  const lastProcessedApiMinuteRef = useRef(match.minute || 0)
  const lastPlayerStatsRef = useRef({})
  const statsInitializedRef = useRef(false)

  // Expire doubleDown when its timer runs out
  useEffect(() => {
    if (doubleDownActive && minute >= doubleDownActive.endsAtMinute) {
      setDoubleDownActive(null)
      addSystemTicker('⚡ Double Down expired.')
    }
  }, [minute, doubleDownActive])

  // Expire freeze when its timer runs out
  useEffect(() => {
    if (freezeActive && minute >= freezeActive.endsAtMinute) {
      setFreezeActive(null)
      addSystemTicker('🧊 Freeze expired.')
    }
  }, [minute, freezeActive])

  // Clock: 1 sim-minute = EVENT_INTERVAL_MS / 25 real-ms (~1 s)
  useEffect(() => {
    const clockInterval = EVENT_INTERVAL_MS / 25
    clockRef.current = setInterval(() => {
      setMinute(prev => prev >= MATCH_DURATION ? prev : prev + 1)
    }, clockInterval)
    return () => clearInterval(clockRef.current)
  }, [])

  // Event ticker every EVENT_INTERVAL_MS
  useEffect(() => {
    tickerRef.current = setInterval(() => {
      if (minuteRef.current >= MATCH_DURATION) {
        clearInterval(tickerRef.current)
        return
      }
      fireEvent(minuteRef.current)
    }, EVENT_INTERVAL_MS)
    return () => clearInterval(tickerRef.current)
  }, [effectivePicks])

  // Live API polling — fetch real events every 60 s when watching a live match
  useEffect(() => {
    if (!isLiveApiMode) return

    const poll = async () => {
      try {
        const allPicks = [...effectivePicksRef.current.player, ...effectivePicksRef.current.cpu]

        // Goals and cards from the events endpoint
        const rawEvents = await fetchFixtureEvents(match.id)
        const newEvents = mapApiEventsToGame(rawEvents, allPicks, lastProcessedApiMinuteRef.current)
        for (const { player, eventType, minute: evMin } of newEvents) {
          if (player) fireEvent(evMin, player, eventType)
        }
        if (newEvents.length > 0) {
          lastProcessedApiMinuteRef.current = Math.max(
            lastProcessedApiMinuteRef.current,
            ...newEvents.map(e => e.minute),
          )
        }

        // Passes, shots blocked, interceptions from the player stats endpoint
        const rawStats = await fetchPlayerStats(match.id)
        if (Object.keys(rawStats).length > 0) {
          if (!statsInitializedRef.current) {
            // First poll: set baseline only, award nothing
            lastPlayerStatsRef.current = rawStats
            statsInitializedRef.current = true
          } else {
            const statEvents = mapPlayerStatsToEvents(rawStats, lastPlayerStatsRef.current, allPicks)
            const currentMin = minuteRef.current
            for (const { player, eventType } of statEvents) {
              if (player) fireEvent(currentMin, player, eventType)
            }
            lastPlayerStatsRef.current = rawStats
          }
        }
      } catch (err) {
        console.warn('Live event poll failed:', err.message)
      }
    }

    poll()
    const interval = setInterval(poll, LIVE_POLL_MS)
    return () => clearInterval(interval)
  }, [isLiveApiMode, effectivePicks])

  // End game
  useEffect(() => {
    if (minute >= MATCH_DURATION && !gameOver) {
      setGameOver(true)
      clearInterval(clockRef.current)
      clearInterval(tickerRef.current)
    }
  }, [minute, gameOver])

  useEffect(() => {
    if (gameOver) {
      setShowGameOver(true)
      setTimeout(() => {
        onEnd({
          scores: scoresRef.current,
          ticker: tickerStateRef.current,
          playerPoints: playerPointsRef.current,
        })
      }, 3000)
    }
  }, [gameOver])

  function fireEvent(currentMinute, overridePlayer = null, overrideEventType = null) {
    const allOnPitch = [...effectivePicks.player, ...effectivePicks.cpu]

    let player, eventType, points
    if (overridePlayer && overrideEventType) {
      player = overridePlayer
      eventType = overrideEventType
      points = SCORING[overrideEventType]?.points ?? 0
    } else {
      const event = generateEvent(allOnPitch, currentMinute, isLiveApiMode)
      if (!event) return
      ;({ player, eventType, points } = event)
    }

    const owner = effectivePicks.player.find(p => p.id === player.id) ? 'player' : 'cpu'

    const dd = doubleDownRef.current
    const fr = freezeRef.current

    const isFrozen = fr && fr.playerId === player.id && currentMinute < fr.endsAtMinute
    const isDoubled = dd && dd.playerId === player.id && dd.owner === owner && currentMinute < dd.endsAtMinute
    const isCaptain = effectivePicks[owner][0]?.id === player.id

    let effectivePoints = isFrozen ? 0 : points
    if (!isFrozen && isCaptain) effectivePoints = effectivePoints * 1.5
    if (!isFrozen && isDoubled) effectivePoints = effectivePoints * 2

    const tickerEntry = {
      minute: currentMinute,
      player: player.name,
      team: player.team,
      eventType,
      points: effectivePoints,
      owner,
      frozen: isFrozen,
      doubled: isDoubled && !isFrozen,
      captain: isCaptain && !isFrozen,
      id: Date.now() + Math.random(),
    }

    setTicker(prev => [tickerEntry, ...prev].slice(0, 30))

    if (!isFrozen && effectivePoints !== 0) {
      setPlayerPoints(prev => ({
        ...prev,
        [player.id]: [...(prev[player.id] || []), { eventType, points: effectivePoints, minute: currentMinute }],
      }))
      setScores(prev => ({ ...prev, [owner]: prev[owner] + effectivePoints }))
    }

    // Goal flash on player card
    if (eventType === 'goal' && !isFrozen) {
      const pid = player.id
      setGoalFlash(prev => ({ ...prev, [pid]: true }))
      setTimeout(() => setGoalFlash(prev => { const n = { ...prev }; delete n[pid]; return n }), 1000)
    }

    // Floating points overlay
    if (!isFrozen && effectivePoints > 0) {
      const fpId = Date.now() + Math.random()
      const xOff = (Math.random() - 0.5) * 48
      setFloatingPoints(prev => [...prev, { id: fpId, pts: effectivePoints, xOff }])
      setTimeout(() => setFloatingPoints(prev => prev.filter(p => p.id !== fpId)), 1500)
    }
  }

  function triggerScreenFlash(color) {
    const id = Date.now()
    setScreenFlash({ color, id })
    setTimeout(() => setScreenFlash(null), 600)
  }

  function confirmDoubleDown(player) {
    setDoubleDownModal(false)
    triggerScreenFlash('yellow')
    setPowerups(prev => ({ ...prev, player: { ...prev.player, doubleDown: true } }))
    setDoubleDownActive({ playerId: player.id, owner: 'player', endsAtMinute: minuteRef.current + 10 })
    addSystemTicker(`⚡ Double Down on ${player.name}! Points doubled for 10 minutes.`)
  }

  function confirmFreeze(player) {
    setFreezeModal(false)
    triggerScreenFlash('blue')
    setPowerups(prev => ({ ...prev, player: { ...prev.player, freeze: true } }))
    setScores(prev => ({ ...prev, player: prev.player - 50 }))
    setFreezeActive({ playerId: player.id, endsAtMinute: minuteRef.current + 10, frozenBy: 'player' })
    addSystemTicker(`🧊 ${player.name} frozen for 10 minutes! (−50 pts)`)
  }

  function confirmWildcard(oldPlayer, newPlayer) {
    setWildcardState({ open: false })
    triggerScreenFlash('white')
    setPowerups(prev => ({ ...prev, player: { ...prev.player, wildcard: true } }))
    setEffectivePicks(prev => ({
      ...prev,
      player: prev.player.map(p => p.id === oldPlayer.id ? newPlayer : p),
    }))
    addSystemTicker(`🔄 Wildcarded ${oldPlayer.name} → ${newPlayer.name}!`)
  }

  function addSystemTicker(msg) {
    setTicker(prev => [{
      minute: minuteRef.current,
      system: true,
      message: msg,
      id: Date.now() + Math.random(),
    }, ...prev].slice(0, 30))
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Match header */}
      <div className="text-center mb-4">
        <div className="flex items-center justify-center gap-3 mb-1">
          <span className="text-xl">{match.home.flag}</span>
          <span className="font-orbitron text-lg font-black text-white">
            {match.homeScore ?? 0}–{match.awayScore ?? 0}
          </span>
          <span className="text-xl">{match.away.flag}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          {gameOver ? (
            <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
              FULL TIME
            </span>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="font-orbitron text-green-400 font-bold text-sm">{minute}'</span>
            </>
          )}
        </div>
      </div>

      {/* Score board */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <ScoreCard label="You" score={scores.player} color="green" />
        <ScoreCard label="CPU" score={scores.cpu} color="yellow" />
      </div>

      {/* Rosters */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <RosterColumn
          label="Your Players"
          players={effectivePicks.player}
          playerPoints={playerPoints}
          isPlayer
          captainId={effectivePicks.player[0]?.id}
          powerups={powerups.player}
          playerScore={scores.player}
          doubleDownActive={doubleDownActive}
          freezeActive={freezeActive}
          minute={minute}
          goalFlash={goalFlash}
          onDoubleDown={() => setDoubleDownModal(true)}
          onFreeze={() => setFreezeModal(true)}
          onWildcard={() => setWildcardState({ open: true })}
        />
        <RosterColumn
          label="CPU Players"
          players={effectivePicks.cpu}
          playerPoints={playerPoints}
          isPlayer={false}
          captainId={effectivePicks.cpu[0]?.id}
          doubleDownActive={doubleDownActive}
          freezeActive={freezeActive}
          minute={minute}
          goalFlash={goalFlash}
        />
      </div>

      {/* Live ticker */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[#1e2b25] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Live Feed</span>
        </div>
        <div className="max-h-48 overflow-y-auto scrollbar-hide divide-y divide-[#1e2b25]">
          {ticker.length === 0 && (
            <p className="text-green-800 text-xs text-center py-6">Waiting for events…</p>
          )}
          {ticker.map(entry => <TickerRow key={entry.id} entry={entry} />)}
        </div>
      </div>

      {/* Modals */}
      {doubleDownModal && (
        <DoubleDownModal
          players={effectivePicks.player}
          playerPoints={playerPoints}
          onConfirm={confirmDoubleDown}
          onCancel={() => setDoubleDownModal(false)}
        />
      )}
      {freezeModal && (
        <FreezeModal
          players={effectivePicks.cpu}
          playerPoints={playerPoints}
          onConfirm={confirmFreeze}
          onCancel={() => setFreezeModal(false)}
        />
      )}
      {wildcardState.open && (
        <WildcardModal
          myPicks={effectivePicks.player}
          allPlayers={allPlayers}
          drafted={[...effectivePicks.player, ...effectivePicks.cpu].map(p => p.id)}
          onConfirm={confirmWildcard}
          onCancel={() => setWildcardState({ open: false })}
        />
      )}

      {/* Floating points overlay */}
      {floatingPoints.map(fp => (
        <div
          key={fp.id}
          className="fixed pointer-events-none z-40 animate-float-up"
          style={{ top: '5rem', left: `calc(50% + ${fp.xOff}px)`, transform: 'translateX(-50%)' }}
        >
          <span className="font-orbitron font-black text-3xl"
            style={{ color: '#00ff87', textShadow: '0 0 16px #00ff87, 0 0 32px rgba(0,255,135,0.4)' }}>
            +{fp.pts}
          </span>
        </div>
      ))}

      {/* Screen edge flash for power-ups */}
      {screenFlash && (
        <div
          key={screenFlash.id}
          className="fixed inset-0 pointer-events-none z-40 animate-screen-flash"
          style={{
            boxShadow: `inset 0 0 80px 24px ${
              screenFlash.color === 'yellow' ? 'rgba(255,230,0,0.5)' :
              screenFlash.color === 'blue'   ? 'rgba(0,191,255,0.5)' :
                                               'rgba(255,255,255,0.35)'
            }`,
          }}
        />
      )}

      {/* GAME OVER banner */}
      {showGameOver && (
        <div className="fixed inset-0 bg-[#0a0f0d]/95 flex items-center justify-center z-50">
          <div className="text-center animate-game-over">
            <p className="font-orbitron font-black text-7xl leading-none"
              style={{ color: '#00ff87', textShadow: '0 0 20px #00ff87, 0 0 60px rgba(0,255,135,0.5)' }}>
              GAME
            </p>
            <p className="font-orbitron font-black text-7xl leading-none mt-1"
              style={{ color: '#00ff87', textShadow: '0 0 20px #00ff87, 0 0 60px rgba(0,255,135,0.5)' }}>
              OVER
            </p>
            <p className="text-green-600 text-xs mt-6 animate-pulse tracking-widest uppercase">Loading results…</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ScoreCard({ label, score, color }) {
  const isGreen = color === 'green'
  return (
    <div className={`rounded-xl border py-3 text-center ${
      isGreen ? 'border-green-500/40 bg-green-950/20 card-neon' : 'border-yellow-500/30 bg-yellow-950/10'
    }`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${isGreen ? 'text-green-500' : 'text-yellow-500'}`}>
        {label}
      </p>
      <p className={`font-orbitron text-4xl font-black mt-0.5 ${isGreen ? 'text-green-300' : 'text-yellow-300'}`}
        style={{ textShadow: isGreen ? '0 0 12px rgba(0,255,135,0.4)' : '0 0 12px rgba(255,230,0,0.3)' }}>
        {score}
      </p>
      <p className="text-green-700 text-xs">pts</p>
    </div>
  )
}

function RosterColumn({ label, players, playerPoints, isPlayer, captainId, powerups, playerScore, doubleDownActive, freezeActive, minute, goalFlash = {}, onDoubleDown, onFreeze, onWildcard }) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${isPlayer ? 'text-green-400' : 'text-yellow-400'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        {players.map(player => {
          const pts = (playerPoints[player.id] || []).reduce((s, e) => s + e.points, 0)
          const isDoubled = doubleDownActive?.playerId === player.id
          const isFrozen = freezeActive?.playerId === player.id
          const isCaptain = player.id === captainId
          const ddRemaining = isDoubled ? Math.max(0, doubleDownActive.endsAtMinute - minute) : 0
          const frRemaining = isFrozen ? Math.max(0, freezeActive.endsAtMinute - minute) : 0

          return (
            <div
              key={player.id}
              className={`rounded-lg border px-2.5 py-2 text-xs transition-all ${
                goalFlash[player.id]
                  ? 'animate-goal-flash border-green-400/60 bg-green-950/20'
                  : isFrozen
                  ? 'border-blue-500/40 bg-blue-950/20'
                  : isDoubled
                  ? 'border-yellow-400/50 bg-yellow-950/20'
                  : isCaptain
                  ? isPlayer ? 'border-yellow-500/30 bg-yellow-950/10' : 'border-yellow-500/20 bg-yellow-950/10'
                  : isPlayer
                  ? 'border-green-500/20 bg-green-950/10'
                  : 'border-yellow-500/20 bg-yellow-950/10'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {isCaptain && <CaptainBadge size="sm" />}
                  <span className="font-semibold text-green-100 truncate">{player.name}</span>
                </div>
                <span className={`font-black flex-shrink-0 ${pts >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pts > 0 ? '+' : ''}{pts}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-green-700">{player.position}</span>
                {isCaptain && <span className="text-yellow-500 text-[10px]">1.5×</span>}
                {isDoubled && ddRemaining > 0 && (
                  <span className="text-yellow-300 text-[10px] font-bold bg-yellow-900/40 px-1.5 py-0.5 rounded-full">
                    🔥 {ddRemaining} min left
                  </span>
                )}
                {isFrozen && frRemaining > 0 && (
                  <span className="text-blue-300 text-[10px] font-bold bg-blue-900/40 px-1.5 py-0.5 rounded-full">
                    ❄️ {frRemaining} min left
                  </span>
                )}
              </div>
              {(playerPoints[player.id] || []).map((ev, i) => (
                <div key={i} className={`text-[10px] mt-0.5 ${ev.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {ev.minute}' {SCORING[ev.eventType]?.label} {ev.points > 0 ? '+' : ''}{ev.points}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {isPlayer && (
        <div className="mt-3 space-y-1.5">
          <button
            onClick={onDoubleDown}
            disabled={powerups?.doubleDown}
            className="w-full py-1.5 rounded-lg text-xs font-bold border border-yellow-500/30 text-yellow-400 hover:bg-yellow-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {powerups?.doubleDown ? '⚡ Used' : '⚡ Double Down'}
          </button>
          <button
            onClick={onWildcard}
            disabled={powerups?.wildcard}
            className="w-full py-1.5 rounded-lg text-xs font-bold border border-purple-500/30 text-purple-400 hover:bg-purple-950/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {powerups?.wildcard ? '🔄 Used' : '🔄 Wildcard'}
          </button>
          <button
            onClick={onFreeze}
            disabled={powerups?.freeze || playerScore < 50}
            className={`w-full py-1.5 rounded-lg text-xs font-bold border transition-colors ${
              powerups?.freeze
                ? 'border-blue-500/20 text-blue-700 opacity-30 cursor-not-allowed'
                : playerScore < 50
                ? 'border-blue-500/20 text-blue-700 cursor-not-allowed'
                : 'border-blue-500/30 text-blue-400 hover:bg-blue-950/20'
            }`}
          >
            {powerups?.freeze
              ? '🧊 Used'
              : playerScore < 50
              ? '🧊 Freeze (need 50 pts)'
              : '🧊 Freeze (−50 pts)'}
          </button>
        </div>
      )}
    </div>
  )
}

function TickerRow({ entry }) {
  if (entry.system) {
    return (
      <div className="px-4 py-2 bg-green-950/20">
        <p className="text-xs text-green-300 font-medium">{entry.message}</p>
      </div>
    )
  }
  const pts = entry.points
  const color = pts > 0 ? 'text-green-400' : pts < 0 ? 'text-red-400' : 'text-blue-400'
  const label = SCORING[entry.eventType]?.label || entry.eventType

  return (
    <div className="px-4 py-2 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-green-700 text-xs font-medium mr-1">{entry.minute}'</span>
        <span className="text-green-100 text-xs font-semibold">{entry.player}</span>
        <span className="text-green-600 text-xs mx-1">·</span>
        <span className="text-green-500 text-xs">{label}</span>
        {entry.captain && <span className="text-yellow-400 text-xs ml-1">© 1.5×</span>}
        {entry.frozen && <span className="text-blue-400 text-xs ml-1">❄️ blocked</span>}
        {entry.doubled && <span className="text-yellow-400 text-xs ml-1">⚡ 2×</span>}
      </div>
      <span className={`text-xs font-black flex-shrink-0 ${color}`}>
        {pts > 0 ? '+' : ''}{entry.frozen ? '0' : pts}
      </span>
    </div>
  )
}

// ── Power-up Modals ─────────────────────────────────────────────────────────

function DoubleDownModal({ players, playerPoints, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-yellow-500/40 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚡</span>
          <h3 className="font-black text-yellow-400 text-lg">Double Down</h3>
        </div>
        <p className="text-green-600 text-xs mb-5">
          Choose a player to double their points for the next 10 minutes.
        </p>

        <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">Your Players</p>
        <div className="space-y-2 mb-5">
          {players.map(p => {
            const pts = (playerPoints[p.id] || []).reduce((s, e) => s + e.points, 0)
            return (
              <button
                key={p.id}
                onClick={() => onConfirm(p)}
                className="w-full flex items-center justify-between rounded-xl border border-[#1e2b25] bg-[#0a0f0d] px-4 py-3 hover:border-yellow-500/60 hover:bg-yellow-950/10 transition-all group"
              >
                <div className="text-left">
                  <p className="font-bold text-sm text-green-100 group-hover:text-yellow-200 transition-colors">{p.name}</p>
                  <p className="text-green-600 text-xs mt-0.5">{p.team} · {p.position}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${pts >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pts > 0 ? '+' : ''}{pts}
                  </p>
                  <p className="text-green-700 text-[10px]">pts</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm font-medium hover:text-green-400 hover:border-green-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function FreezeModal({ players, playerPoints, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-blue-500/40 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🧊</span>
          <h3 className="font-black text-blue-400 text-lg">Freeze</h3>
        </div>
        <p className="text-green-600 text-xs mb-5">
          Choose an opponent player to freeze for 10 minutes. Costs you <span className="text-blue-400 font-bold">50 pts</span>.
        </p>

        <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">CPU Players</p>
        <div className="space-y-2 mb-5">
          {players.map(p => {
            const pts = (playerPoints[p.id] || []).reduce((s, e) => s + e.points, 0)
            return (
              <button
                key={p.id}
                onClick={() => onConfirm(p)}
                className="w-full flex items-center justify-between rounded-xl border border-[#1e2b25] bg-[#0a0f0d] px-4 py-3 hover:border-blue-500/60 hover:bg-blue-950/10 transition-all group"
              >
                <div className="text-left">
                  <p className="font-bold text-sm text-green-100 group-hover:text-blue-200 transition-colors">{p.name}</p>
                  <p className="text-green-600 text-xs mt-0.5">{p.team} · {p.position}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${pts >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {pts > 0 ? '+' : ''}{pts}
                  </p>
                  <p className="text-green-700 text-[10px]">pts</p>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm font-medium hover:text-green-400 hover:border-green-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function WildcardModal({ myPicks, allPlayers, drafted, onConfirm, onCancel }) {
  const [selectedOld, setSelectedOld] = useState(null)
  const available = allPlayers.filter(p => !drafted.includes(p.id))

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#111815] border border-purple-500/30 rounded-2xl w-full max-w-sm p-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🔄</span>
          <h3 className="font-black text-purple-400 text-lg">Wildcard</h3>
        </div>
        <p className="text-green-600 text-xs mb-4">Swap one of your players for someone still on the pitch.</p>

        <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">Your Players</p>
        <div className="space-y-1.5 mb-4">
          {myPicks.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedOld(p)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                selectedOld?.id === p.id
                  ? 'border-purple-400 bg-purple-900/20 text-purple-200'
                  : 'border-[#1e2b25] text-green-300 hover:border-purple-700'
              }`}
            >
              {p.name} · <span className="text-green-600 text-xs">{p.position}</span>
            </button>
          ))}
        </div>

        {selectedOld && (
          <>
            <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-2">Replace with</p>
            <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide mb-4">
              {available.length === 0 && <p className="text-green-800 text-xs">No available players</p>}
              {available.map(p => (
                <button
                  key={p.id}
                  onClick={() => onConfirm(selectedOld, p)}
                  className="w-full text-left rounded-lg border border-[#1e2b25] px-3 py-2 text-sm text-green-300 hover:border-purple-500 hover:bg-purple-950/10 transition-colors"
                >
                  {p.name} · <span className="text-green-600 text-xs">{p.team} · {p.position}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl border border-[#1e2b25] text-green-600 text-sm font-medium hover:text-green-400 hover:border-green-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

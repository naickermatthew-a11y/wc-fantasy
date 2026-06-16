import { useState, useEffect, useRef } from 'react'
import { autoPick } from '../lib/roomUtils'
import { playTick } from '../lib/sounds'
import { useLineupFetch } from '../hooks/useLineupFetch'
import { SectionedPlayerList, LineupStatusBadge } from '../components/PlayerSection'
import CountdownRing from '../components/CountdownRing'
import CaptainBadge from '../components/CaptainBadge'
import FlagImg from '../components/FlagImg'

const DRAFT_ORDER = ['player', 'cpu', 'cpu', 'player']
const PICK_SECONDS = 30

export default function DraftScreen({ match, onComplete }) {
  // Draft state (defined first so isDraftStarted is available for lineup hook)
  const [picks, setPicks] = useState({ player: [], cpu: [] })
  const [turn, setTurn] = useState(0)
  const [drafted, setDrafted] = useState(new Set())
  const [cpuThinking, setCpuThinking] = useState(false)
  const [secsLeft, setSecsLeft] = useState(PICK_SECONDS)
  const [openSections, setOpenSections] = useState({ defence: true, midfield: true, attack: true })

  const cpuTimerRef = useRef(null)
  const countdownRef = useRef(null)
  const turnRef = useRef(turn)
  const draftedRef = useRef(drafted)
  turnRef.current = turn
  draftedRef.current = drafted

  // Lineup: starts with estimated squads, upgrades to official API lineup automatically
  const isDraftStarted = turn > 0 || drafted.size > 0
  const { players, lineupConfirmed, checkingLineup, nextCheckSecs } = useLineupFetch(match, isDraftStarted)
  const playersRef = useRef(players)
  playersRef.current = players

  const currentDrafter = DRAFT_ORDER[turn]
  const isDone = turn >= DRAFT_ORDER.length

  // ── CPU auto-pick after 2 s ───────────────────────────────────────────────
  useEffect(() => {
    if (isDone || currentDrafter !== 'cpu' || playersRef.current.length === 0) return
    setCpuThinking(true)
    cpuTimerRef.current = setTimeout(() => {
      const available = playersRef.current.filter(p => !draftedRef.current.has(p.id))
      const pick = autoPick(available)
      if (pick) doPick(pick)
      setCpuThinking(false)
    }, 2000)
    return () => clearTimeout(cpuTimerRef.current)
  }, [turn])

  // ── Player countdown timer ────────────────────────────────────────────────
  useEffect(() => {
    if (isDone || currentDrafter !== 'player' || playersRef.current.length === 0) return

    setSecsLeft(PICK_SECONDS)
    clearInterval(countdownRef.current)

    let remaining = PICK_SECONDS
    countdownRef.current = setInterval(() => {
      remaining -= 1
      setSecsLeft(remaining)

      if (remaining <= 5 && remaining > 0) {
        playTick(remaining === 1)
      }

      if (remaining <= 0) {
        clearInterval(countdownRef.current)
        const available = playersRef.current.filter(p => !draftedRef.current.has(p.id))
        const pick = autoPick(available)
        if (pick) doPick(pick)
      }
    }, 1000)

    return () => clearInterval(countdownRef.current)
  }, [turn])

  // ── Draft complete ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDone) setTimeout(() => onComplete(picks, playersRef.current), 600)
  }, [isDone])

  function doPick(player) {
    clearInterval(countdownRef.current)
    const drafter = DRAFT_ORDER[turnRef.current]
    setDrafted(prev => new Set([...prev, player.id]))
    setPicks(prev => ({ ...prev, [drafter]: [...prev[drafter], player] }))
    setTurn(prev => prev + 1)
  }

  const available = players.filter(p => !drafted.has(p.id))
  const isPlayerTurn = !isDone && currentDrafter === 'player'

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="font-orbitron text-2xl font-black text-green-400" style={{ textShadow: '0 0 12px rgba(0,255,135,0.4)' }}>Draft Players</h2>
        <div className="flex items-center justify-center gap-2 mt-1 text-green-600 text-sm">
          <FlagImg code={match.home.flag} name={match.home.name} size="sm" />
          <span>{match.home.name}</span>
          <span className="text-green-800">vs</span>
          <FlagImg code={match.away.flag} name={match.away.name} size="sm" />
          <span>{match.away.name}</span>
        </div>
      </div>

      {/* Pick order tracker */}
      <PickOrderTracker order={DRAFT_ORDER} currentTurn={turn} isDone={isDone} />

      {/* Turn indicator with countdown ring */}
      <div className={`rounded-xl px-4 py-3 mb-5 border flex items-center gap-4 ${
        isDone
          ? 'border-green-500/30 bg-green-950/20'
          : isPlayerTurn
          ? secsLeft <= 5
            ? 'border-red-500/50 bg-red-950/10'
            : secsLeft <= 10
            ? 'border-orange-500/40 bg-orange-950/10'
            : 'border-green-500/50 bg-green-900/20'
          : 'border-yellow-500/30 bg-yellow-950/10'
      }`}>
        <div className="flex-1">
          {isDone ? (
            <p className="font-bold text-green-400">Draft complete! Starting match…</p>
          ) : cpuThinking ? (
            <p className="font-bold text-yellow-400 animate-pulse">CPU is thinking…</p>
          ) : isPlayerTurn ? (
            <>
              <p className={`font-bold ${secsLeft <= 5 ? 'text-red-300' : secsLeft <= 10 ? 'text-orange-300' : 'text-green-300'}`}>
                Your pick
              </p>
              <p className="text-green-700 text-xs mt-0.5">
                {secsLeft <= 5 ? '⚠️ Hurry! Auto-picking soon…' : 'Choose a player below'}
              </p>
            </>
          ) : (
            <p className="font-bold text-yellow-400">CPU's turn</p>
          )}
        </div>

        {isPlayerTurn && !isDone && (
          <CountdownRing seconds={secsLeft} total={PICK_SECONDS} />
        )}
      </div>

      {/* Draft columns */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <DraftColumn label="Your Team" picks={picks.player} color="green" />
        <DraftColumn label="CPU Team" picks={picks.cpu} color="yellow" />
      </div>

      {/* Available players — grouped by position */}
      {isPlayerTurn && !isDone && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-green-600 text-xs font-semibold uppercase tracking-widest">Pick a player</p>
            <LineupStatusBadge
              match={match}
              lineupConfirmed={lineupConfirmed}
              checkingLineup={checkingLineup}
              nextCheckSecs={nextCheckSecs}
            />
          </div>
          <SectionedPlayerList
            players={available}
            onPick={doPick}
            urgent={secsLeft <= 10}
            openSections={openSections}
            onToggleSection={key => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
          />
        </div>
      )}
    </div>
  )
}

function PickOrderTracker({ order, currentTurn, isDone }) {
  const LABELS = { player: 'You', cpu: 'CPU' }

  return (
    <div className="flex justify-center mb-5">
      {order.map((drafter, i) => {
        const completed = i < currentTurn || isDone
        const active = i === currentTurn && !isDone
        const isLast = i === order.length - 1
        const isCaptain = i === 0
        const label = LABELS[drafter]

        return (
          <div key={i} className="flex items-start">
            <div className="flex flex-col items-center" style={{ width: 56 }}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                completed
                  ? 'bg-green-600 border-green-500'
                  : active
                  ? 'bg-green-500 border-green-300 ring-4 ring-green-500/20 animate-pulse'
                  : 'bg-[#111815] border-[#1e2b25]'
              }`}>
                {completed ? (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8.5l3 3L13 5" />
                  </svg>
                ) : (
                  <span className={`text-xs font-black tabular-nums ${active ? 'text-[#0a0f0d]' : 'text-green-800'}`}>
                    {i + 1}
                  </span>
                )}
              </div>
              <p className={`text-[10px] font-bold mt-1.5 text-center transition-colors ${
                completed ? 'text-green-600' : active ? 'text-green-300' : 'text-green-800'
              }`}>
                {label}
              </p>
              {isCaptain && (
                <span className={`text-[9px] font-black leading-tight transition-colors ${
                  completed ? 'text-yellow-600' : active ? 'text-yellow-400' : 'text-yellow-900'
                }`}>
                  CPT
                </span>
              )}
            </div>
            {!isLast && (
              <div className="flex flex-col items-center" style={{ paddingTop: 18 }}>
                <div className={`h-px transition-colors duration-300 ${
                  completed ? 'bg-green-600' : 'bg-[#1e2b25]'
                }`} style={{ width: 16 }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DraftColumn({ label, picks, color }) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${color === 'green' ? 'text-green-400' : 'text-yellow-400'}`}>
        {label}
      </p>
      <div className="space-y-2">
        {[0, 1].map(i => (
          <div
            key={i}
            className={`rounded-lg border px-3 py-2 min-h-[52px] flex items-center ${
              picks[i]
                ? i === 0
                  ? 'border-yellow-500/40 bg-yellow-950/10'
                  : color === 'green'
                  ? 'border-green-500/40 bg-green-950/20'
                  : 'border-yellow-500/30 bg-yellow-950/10'
                : 'border-[#1e2b25] bg-[#111815]'
            }`}
          >
            {picks[i] ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {i === 0 && <CaptainBadge size="sm" />}
                  <p className="font-semibold text-sm text-green-100 truncate">{picks[i].name}</p>
                </div>
                <p className="text-xs text-green-600 mt-0.5">
                  {picks[i].team} · {picks[i].position}
                  {i === 0 && <span className="text-yellow-500 ml-1">1.5×</span>}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-green-800 text-xs">{i === 0 ? 'Captain slot' : 'Empty'}</p>
                {i === 0 && <p className="text-green-900 text-[10px]">First pick = captain</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

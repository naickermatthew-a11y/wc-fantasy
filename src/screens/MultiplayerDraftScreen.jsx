import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { buildSnakeDraftOrder, totalDraftPicks, autoPick, PLAYER_COLORS, COLOR_CLASSES } from '../lib/roomUtils'
import { playTick } from '../lib/sounds'
import { useLineupFetch } from '../hooks/useLineupFetch'
import { SectionedPlayerList, LineupStatusBadge } from '../components/PlayerSection'
import CountdownRing from '../components/CountdownRing'
import CaptainBadge from '../components/CaptainBadge'
import FlagImg from '../components/FlagImg'
import RoomCodePill from '../components/RoomCodePill'

const PICK_SECONDS = 30

export default function MultiplayerDraftScreen({ roomInfo, room: initialRoom, players: initialPlayers, match, onComplete }) {
  const { code, userId, isHost } = roomInfo
  const [room, setRoom] = useState(initialRoom)
  const [players, setPlayers] = useState(initialPlayers)
  const [secsLeft, setSecsLeft] = useState(PICK_SECONDS)
  const [openSections, setOpenSections] = useState({ defence: true, midfield: true, attack: true })
  const timerRef = useRef(null)
  const autoPickRef = useRef(false)
  // Always-current ref so timer callbacks don't close over stale available/picks
  const availableRef = useRef([])

  const snakeOrder = buildSnakeDraftOrder(players.map(p => p.user_id))
  const totalPicks = totalDraftPicks(players.length)
  const pickIndex = room.draft_pick_index ?? 0
  const isDone = pickIndex >= totalPicks
  const currentTurnUserId = isDone ? null : snakeOrder[pickIndex]
  const isMyTurn = currentTurnUserId === userId

  // Lineup: starts with estimated squads, upgrades to official API lineup
  // We don't replace the list after the first pick is made
  const isDraftStarted = pickIndex > 0
  const { players: allFantasyPlayers, lineupConfirmed, checkingLineup, nextCheckSecs } = useLineupFetch(match, isDraftStarted)

  const draftedIds = new Set(players.flatMap(p => (p.picks || []).map(fp => fp.id)))
  const available = allFantasyPlayers.filter(p => !draftedIds.has(p.id))
  availableRef.current = available

  function syncState({ room: r, players: p }) {
    if (r) setRoom(r)
    if (p) {
      const sorted = [...p].sort((a, b) => a.pick_order - b.pick_order)
      setPlayers(sorted)
    }
  }

  useEffect(() => {
    if (isDone) {
      // Refetch picks from the DB — local `players` state may not yet reflect the
      // last pick because the rooms UPDATE (triggering isDone) arrives before
      // the room_players UPDATE in Supabase's real-time delivery order.
      const t = setTimeout(async () => {
        const { data } = await supabase
          .from('room_players')
          .select('*')
          .eq('room_code', code)
          .order('pick_order')
        onComplete({ room, players: data || players })
      }, 400)
      return () => clearTimeout(t)
    }

    clearInterval(timerRef.current)
    autoPickRef.current = false

    const timerStart = room.game_state?.draftTimerStartedAt || Date.now()
    const elapsed = Math.floor((Date.now() - timerStart) / 1000)
    const remaining = Math.max(0, PICK_SECONDS - elapsed)
    setSecsLeft(remaining)

    let secs = remaining
    timerRef.current = setInterval(() => {
      secs -= 1
      setSecsLeft(secs)

      if (secs <= 5 && secs > 0 && isMyTurn) {
        playTick(secs === 1)
      }

      if (secs <= 0) {
        clearInterval(timerRef.current)
        if (isHost && !autoPickRef.current) {
          autoPickRef.current = true
          doAutoPickFor(currentTurnUserId)
        }
      }
    }, 1000)

    return () => clearInterval(timerRef.current)
  }, [pickIndex, isDone])

  useEffect(() => {
    const ch = supabase
      .channel(`draft-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        payload => syncState({ room: payload.new }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_players', filter: `room_code=eq.${code}` },
        async () => {
          const { data } = await supabase.from('room_players').select('*').eq('room_code', code).order('pick_order')
          if (data) syncState({ players: data })
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [code])

  async function doAutoPickFor(turnUserId) {
    const player = autoPick(availableRef.current)
    if (player) await submitPick(turnUserId, player)
  }

  async function submitPick(turnUserId, fantasyPlayer) {
    const pickerRow = players.find(p => p.user_id === turnUserId)
    if (!pickerRow) return

    const updatedPicks = [...(pickerRow.picks || []), fantasyPlayer]
    const nextIndex = pickIndex + 1

    await supabase.from('room_players')
      .update({ picks: updatedPicks })
      .eq('room_code', code).eq('user_id', turnUserId)

    await supabase.from('rooms').update({
      draft_pick_index: nextIndex,
      game_state: {
        ...room.game_state,
        draftTimerStartedAt: Date.now(),
        ...(nextIndex >= totalPicks ? { status: 'playing' } : {}),
      },
      ...(nextIndex >= totalPicks ? { status: 'playing' } : {}),
    }).eq('code', code)
  }

  async function handlePick(fantasyPlayer) {
    if (!isMyTurn) return
    clearInterval(timerRef.current)
    await submitPick(userId, fantasyPlayer)
  }

  const myColorIdx = players.findIndex(p => p.user_id === userId)
  const myColor = PLAYER_COLORS[myColorIdx] || 'green'

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <RoomCodePill code={code} />
      <div className="text-center mb-5">
        <h2 className="font-orbitron text-2xl font-black text-green-400">Draft</h2>
        {match && (
          <div className="flex items-center justify-center gap-2 mt-1 text-green-600 text-sm">
            <FlagImg code={match.home?.flag} name={match.home?.name} size="sm" />
            <span>{match.home?.name}</span>
            <span className="text-green-800">vs</span>
            <FlagImg code={match.away?.flag} name={match.away?.name} size="sm" />
            <span>{match.away?.name}</span>
          </div>
        )}
        <p className="text-green-600 text-sm mt-1">
          Pick {Math.min(pickIndex + 1, totalPicks)} of {totalPicks} · {players.length} players
        </p>
      </div>

      {/* Turn indicator */}
      {!isDone && (
        <div className={`rounded-xl px-4 py-3 mb-4 border flex items-center gap-4 ${
          isMyTurn
            ? secsLeft <= 5
              ? 'border-red-500/50 bg-red-950/10'
              : secsLeft <= 10
              ? 'border-orange-500/40 bg-orange-950/10'
              : 'border-green-500/50 bg-green-900/20'
            : 'border-[#1e2b25] bg-[#111815]'
        }`}>
          <div className="flex-1">
            {isMyTurn ? (
              <>
                <p className={`font-bold ${secsLeft <= 5 ? 'text-red-300' : secsLeft <= 10 ? 'text-orange-300' : 'text-green-300'}`}>
                  Your pick!
                </p>
                {secsLeft <= 5 && (
                  <p className="text-red-500 text-xs mt-0.5">⚠️ Auto-picking soon…</p>
                )}
              </>
            ) : (
              <p className="font-bold text-green-600">
                {players.find(p => p.user_id === currentTurnUserId)?.display_name ?? '…'}'s turn
              </p>
            )}
          </div>
          <CountdownRing seconds={secsLeft} total={PICK_SECONDS} />
        </div>
      )}

      {/* All players' draft slots */}
      <div className={`grid gap-2 mb-4 ${players.length === 2 ? 'grid-cols-2' : players.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {players.map((p, i) => {
          const color = PLAYER_COLORS[i] || 'green'
          const cls = COLOR_CLASSES[color]
          const isCurrent = p.user_id === currentTurnUserId
          return (
            <div key={p.id} className={`rounded-xl border p-2.5 ${isCurrent ? cls.border + ' ' + cls.bg : 'border-[#1e2b25] bg-[#111815]'}`}>
              <p className={`text-xs font-bold mb-2 truncate ${cls.text}`}>
                {p.display_name} {p.user_id === userId ? '(you)' : ''}
                {isCurrent && <span className="ml-1 animate-pulse">●</span>}
              </p>
              {(p.picks || []).map((fp, j) => (
                <div key={j} className={`rounded-lg border px-2 py-1.5 mb-1 text-xs ${j === 0 ? 'border-yellow-500/40 bg-yellow-950/10' : cls.border}`}>
                  <div className="flex items-center gap-1">
                    {j === 0 && <CaptainBadge size="sm" />}
                    <p className="font-semibold text-green-100 truncate">{fp.name}</p>
                  </div>
                  <p className="text-green-600 text-[10px]">
                    {fp.team} · {fp.position}
                    {j === 0 && <span className="text-yellow-500 ml-1">1.5×</span>}
                  </p>
                </div>
              ))}
              {Array.from({ length: 2 - (p.picks || []).length }).map((_, j) => {
                const slotIndex = (p.picks || []).length + j
                return (
                  <div key={j} className="rounded-lg border border-dashed border-[#1e2b25] px-2 py-1.5 mb-1">
                    <p className="text-green-800 text-[10px]">{slotIndex === 0 ? 'Captain slot' : 'Empty'}</p>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Available players — sectioned, same as solo mode */}
      {isMyTurn && !isDone && (
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
            onPick={handlePick}
            openSections={openSections}
            onToggleSection={key => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
          />
        </div>
      )}

      {isDone && (
        <div className="text-center py-4 rounded-xl border border-green-500/30 bg-green-950/20">
          <p className="font-bold text-green-400">Draft complete! Starting match…</p>
        </div>
      )}
    </div>
  )
}

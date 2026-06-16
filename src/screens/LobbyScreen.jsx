import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { PLAYER_COLORS, COLOR_CLASSES } from '../lib/roomUtils'
import { MATCHES } from '../data/matches'

export default function LobbyScreen({ roomInfo, onStart, onBack }) {
  const { code, userId, isHost } = roomInfo
  const [room, setRoom] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function fetchState() {
    const [{ data: r }, { data: p }] = await Promise.all([
      supabase.from('rooms').select('*').eq('code', code).single(),
      supabase.from('room_players').select('*').eq('room_code', code).order('pick_order'),
    ])
    if (r) setRoom(r)
    if (p) setPlayers(p)

    // If room transitioned to drafting (host clicked start), move on
    if (r?.status === 'drafting') {
      onStart({ room: r, players: p })
    }
  }

  useEffect(() => {
    fetchState()

    const roomSub = supabase
      .channel(`lobby-room-${code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, fetchState)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_code=eq.${code}` }, fetchState)
      .subscribe()

    return () => supabase.removeChannel(roomSub)
  }, [code])

  async function handleStart() {
    if (players.length < 2) { setError('Need at least 2 players'); return }
    setLoading(true)
    setError('')

    // Assign pick_order based on join order, update room status
    const updates = players.map((p, i) =>
      supabase.from('room_players').update({ pick_order: i }).eq('id', p.id)
    )
    await Promise.all(updates)

    await supabase.from('rooms').update({
      status: 'drafting',
      draft_pick_index: 0,
      game_state: {
        ...(room.game_state || {}),   // preserve matchData stored at room creation
        scores: Object.fromEntries(players.map(p => [p.user_id, 0])),
        playerPoints: {},
        powerups: Object.fromEntries(players.map(p => [p.user_id, { doubleDown: false, wildcard: false, freeze: false }])),
        doubleDownActive: null,
        freezeActive: null,
        minute: 1,
        gameOver: false,
        draftTimerStartedAt: Date.now(),
      },
    }).eq('code', code)

    setLoading(false)
  }

  const match = room ? MATCHES.find(m => m.id === room.match_id) : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <p className="text-green-600 text-xs font-semibold uppercase tracking-widest mb-2">Room Code</p>
        <p className="text-5xl font-black text-green-300 tracking-widest">{code}</p>
        <p className="text-green-700 text-sm mt-2">Share this code with friends to join</p>
        {match && (
          <p className="text-green-600 text-xs mt-1">
            {match.home.flag} {match.home.name} vs {match.away.flag} {match.away.name}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-green-400 uppercase tracking-widest">Players</p>
          <p className="text-green-700 text-xs">{players.length} / {room?.max_players ?? 4}</p>
        </div>
        <div className="space-y-2">
          {players.map((p, i) => {
            const color = PLAYER_COLORS[i] || 'green'
            const cls = COLOR_CLASSES[color]
            return (
              <div key={p.id} className={`flex items-center gap-3 rounded-xl border ${cls.border} ${cls.bg} px-3 py-2.5`}>
                <span className={`text-xs font-black w-5 h-5 rounded-full flex items-center justify-center ${cls.badge}`}>
                  {i + 1}
                </span>
                <span className="font-semibold text-sm text-green-100">{p.display_name}</span>
                {p.user_id === userId && (
                  <span className="text-green-700 text-xs ml-auto">(you)</span>
                )}
                {p.user_id === room?.host_id && (
                  <span className="text-yellow-600 text-xs ml-auto">host</span>
                )}
              </div>
            )
          })}
          {Array.from({ length: Math.max(0, (room?.max_players ?? 4) - players.length) }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-dashed border-[#1e2b25] px-3 py-2.5">
              <span className="text-green-800 text-xs">Waiting for player…</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-400 text-xs text-center mb-3">{error}</p>}

      {isHost ? (
        <button
          onClick={handleStart}
          disabled={loading || players.length < 2}
          className="w-full py-3.5 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Starting…' : players.length < 2 ? 'Waiting for players…' : 'Start Draft'}
        </button>
      ) : (
        <div className="text-center py-3 rounded-xl border border-[#1e2b25] bg-[#111815]">
          <p className="text-green-600 text-sm animate-pulse">Waiting for host to start…</p>
        </div>
      )}

      <button onClick={onBack} className="w-full mt-3 text-green-800 text-sm hover:text-green-600 transition-colors">
        Leave Room
      </button>
    </div>
  )
}

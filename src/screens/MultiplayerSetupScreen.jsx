import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { generateRoomCode, getUserId, getDisplayName, setDisplayName } from '../lib/roomUtils'

export default function MultiplayerSetupScreen({ match, onRoomCreated, onRoomJoined, onBack }) {
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [roomCode, setRoomCode] = useState('')
  const [name, setName] = useState(getDisplayName())
  const [maxPlayers, setMaxPlayers] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Enter your name'); return }
    setLoading(true)
    setError('')
    setDisplayName(name.trim())
    const userId = getUserId()
    const code = generateRoomCode()

    const { error: roomErr } = await supabase.from('rooms').insert({
      code,
      host_id: userId,
      match_id: match.id,
      status: 'waiting',
      max_players: maxPlayers,
      draft_pick_index: 0,
      // Store match display data so non-host clients can show the correct header
      game_state: {
        matchData: { home: match.home, away: match.away, homeScore: 0, awayScore: 0 },
      },
    })
    if (roomErr) { setError(roomErr.message); setLoading(false); return }

    const { error: playerErr } = await supabase.from('room_players').insert({
      room_code: code,
      user_id: userId,
      display_name: name.trim(),
      pick_order: 0,
      picks: [],
    })
    if (playerErr) { setError(playerErr.message); setLoading(false); return }

    setLoading(false)
    onRoomCreated({ code, userId, isHost: true, matchId: match.id })
  }

  async function handleJoin() {
    if (!name.trim()) { setError('Enter your name'); return }
    if (roomCode.trim().length !== 6) { setError('Enter a 6-character room code'); return }
    setLoading(true)
    setError('')
    setDisplayName(name.trim())
    const userId = getUserId()
    const code = roomCode.trim().toUpperCase()

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .single()

    if (roomErr || !room) { setError('Room not found'); setLoading(false); return }
    if (room.status !== 'waiting') { setError('This game has already started'); setLoading(false); return }

    const { data: existing } = await supabase
      .from('room_players')
      .select('user_id')
      .eq('room_code', code)

    if (existing && existing.length >= room.max_players) {
      setError('Room is full'); setLoading(false); return
    }

    const pickOrder = existing ? existing.length : 0

    const { error: playerErr } = await supabase.from('room_players').upsert({
      room_code: code,
      user_id: userId,
      display_name: name.trim(),
      pick_order: pickOrder,
      picks: [],
    }, { onConflict: 'room_code,user_id' })

    if (playerErr) { setError(playerErr.message); setLoading(false); return }

    setLoading(false)
    onRoomJoined({ code, userId, isHost: room.host_id === userId, matchId: room.match_id })
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button onClick={onBack} className="text-green-600 text-sm mb-6 hover:text-green-400 transition-colors">
        ← Back
      </button>

      <div className="text-center mb-8">
        <div className="text-4xl mb-2">🌐</div>
        <h2 className="text-2xl font-black text-green-400">Multiplayer</h2>
        <p className="text-green-600 text-sm mt-1">
          {match.home.flag} {match.home.name} vs {match.away.flag} {match.away.name}
        </p>
      </div>

      {/* Name input always visible */}
      <div className="mb-5">
        <label className="text-green-500 text-xs font-bold uppercase tracking-widest block mb-1.5">Your Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          placeholder="Enter your name"
          className="w-full bg-[#111815] border border-[#1e2b25] rounded-xl px-4 py-3 text-green-100 placeholder-green-800 focus:outline-none focus:border-green-500/50 text-sm"
        />
      </div>

      {!mode && (
        <div className="space-y-3">
          <button
            onClick={() => setMode('create')}
            className="w-full py-4 rounded-2xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] transition-colors text-base"
          >
            Create Room
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full py-4 rounded-2xl font-bold border border-green-500/40 text-green-400 hover:bg-green-950/20 transition-colors text-base"
          >
            Join Room
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="space-y-4">
          <div>
            <label className="text-green-500 text-xs font-bold uppercase tracking-widest block mb-1.5">Max Players</label>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setMaxPlayers(n)}
                  className={`py-2.5 rounded-xl font-bold text-sm border transition-colors ${
                    maxPlayers === n
                      ? 'border-green-500 bg-green-950/30 text-green-300'
                      : 'border-[#1e2b25] text-green-600 hover:border-green-700'
                  }`}
                >
                  {n} Players
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create Room'}
          </button>
          <button onClick={() => setMode(null)} className="w-full text-green-700 text-sm hover:text-green-500 transition-colors">
            Back
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="space-y-4">
          <div>
            <label className="text-green-500 text-xs font-bold uppercase tracking-widest block mb-1.5">Room Code</label>
            <input
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="ABC123"
              className="w-full bg-[#111815] border border-[#1e2b25] rounded-xl px-4 py-3 text-green-100 placeholder-green-800 focus:outline-none focus:border-green-500/50 text-2xl font-black tracking-widest text-center"
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Joining…' : 'Join Room'}
          </button>
          <button onClick={() => setMode(null)} className="w-full text-green-700 text-sm hover:text-green-500 transition-colors">
            Back
          </button>
        </div>
      )}
    </div>
  )
}

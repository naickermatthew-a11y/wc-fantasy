import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFallbackPlayers } from '../lib/playerUtils'
import { getDisplayName } from '../lib/roomUtils'
import { SectionedPlayerList } from '../components/PlayerSection'
import RoomCodePill from '../components/RoomCodePill'
import CaptainBadge from '../components/CaptainBadge'

export default function LateJoinScreen({ roomInfo, onJoin, onBack }) {
  const { code, userId } = roomInfo

  const [room, setRoom] = useState(null)
  const [existingPlayers, setExistingPlayers] = useState([])
  const [myPicks, setMyPicks] = useState([])
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [openSections, setOpenSections] = useState({ defence: true, midfield: true, attack: true })

  useEffect(() => {
    async function load() {
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase.from('rooms').select('*').eq('code', code).single(),
        supabase.from('room_players').select('*').eq('room_code', code).order('pick_order'),
      ])

      if (!r) { setLoading(false); return }
      setRoom(r)
      setExistingPlayers(p || [])

      const md = r.game_state?.matchData
      const match = md
        ? { id: r.match_id, isApiMatch: true, homeScore: 0, awayScore: 0, ...md }
        : { id: r.match_id }

      const allPlayers = getFallbackPlayers(match)
      const draftedIds = new Set((p || []).flatMap(pl => (pl.picks || []).map(fp => fp.id)))
      setAvailable(allPlayers.filter(fp => !draftedIds.has(fp.id)))
      setLoading(false)
    }
    load()
  }, [code])

  function handlePick(player) {
    const newPicks = [...myPicks, player]
    setMyPicks(newPicks)
    setAvailable(prev => prev.filter(p => p.id !== player.id))
    if (newPicks.length >= 2) completeLateJoin(newPicks)
  }

  async function completeLateJoin(finalPicks) {
    setJoining(true)
    const displayName = getDisplayName()
    const pickOrder = existingPlayers.length

    try {
      await supabase.from('room_players').upsert({
        room_code: code,
        user_id: userId,
        display_name: displayName,
        pick_order: pickOrder,
        picks: finalPicks,
      }, { onConflict: 'room_code,user_id' })

      // Patch game_state to register this user's score/powerup slots
      const { data: freshRoom } = await supabase.from('rooms').select('*').eq('code', code).single()
      if (freshRoom?.game_state) {
        const gs = freshRoom.game_state
        const updatedGS = {
          ...gs,
          scores: { ...(gs.scores || {}), [userId]: 0 },
          playerPoints: gs.playerPoints || {},
          powerups: {
            ...(gs.powerups || {}),
            [userId]: { doubleDown: false, wildcard: false, freeze: false },
          },
        }
        await supabase.from('rooms').update({ game_state: updatedGS }).eq('code', code)
      }

      // Post "X joined the game" to the live ticker
      const minute = freshRoom?.game_state?.minute ?? 1
      await supabase.from('ticker_events').insert({
        room_code: code,
        minute,
        is_system: true,
        message: `${displayName} joined the game`,
        points: 0,
      })

      // Fetch final state to hand off to the game screen
      const [{ data: latestRoom }, { data: latestPlayers }] = await Promise.all([
        supabase.from('rooms').select('*').eq('code', code).single(),
        supabase.from('room_players').select('*').eq('room_code', code).order('pick_order'),
      ])

      const md = latestRoom?.game_state?.matchData
      const match = md
        ? { id: latestRoom.match_id, isApiMatch: true, homeScore: 0, awayScore: 0, ...md }
        : { id: latestRoom?.match_id }

      onJoin({ room: latestRoom, players: latestPlayers || [], match })
    } catch (err) {
      console.error('[LateJoin] error completing join:', err)
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-green-600 text-sm animate-pulse">Loading match…</p>
      </div>
    )
  }

  if (joining) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-green-400 font-bold text-lg mb-1">Joining game…</p>
        <p className="text-green-600 text-sm">Your picks have been saved</p>
      </div>
    )
  }

  const picksDone = myPicks.length >= 2

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <RoomCodePill code={code} />

      <div className="text-center mb-6">
        <div className="text-3xl mb-2">⚡</div>
        <h2 className="text-xl font-black text-green-400">Late Join</h2>
        <p className="text-green-600 text-sm mt-1">The game is live — pick your 2 players to join now</p>
        <p className="text-green-700 text-xs mt-0.5">Your first pick is your captain (1.5× points)</p>
      </div>

      {/* Pick slots */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] p-4 mb-5">
        <p className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">Your Players</p>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map(i => {
            const pick = myPicks[i]
            return pick ? (
              <div key={i} className={`rounded-xl border px-3 py-2.5 ${i === 0 ? 'border-yellow-500/40 bg-yellow-950/10' : 'border-green-500/30 bg-green-950/10'}`}>
                <div className="flex items-center gap-1 mb-0.5">
                  {i === 0 && <CaptainBadge size="sm" />}
                  <span className="text-xs font-bold text-green-100 truncate">{pick.name}</span>
                </div>
                <p className="text-[10px] text-green-600">{pick.team} · {pick.position}</p>
                {i === 0 && <p className="text-[10px] text-yellow-500 mt-0.5">Captain · 1.5×</p>}
              </div>
            ) : (
              <div key={i} className="rounded-xl border border-dashed border-[#1e2b25] px-3 py-2.5 flex items-center justify-center min-h-[60px]">
                <p className="text-green-800 text-xs">{i === 0 ? 'Pick captain' : 'Pick #2'}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Player picker */}
      {!picksDone && (
        <div>
          <p className="text-green-500 text-xs font-bold uppercase tracking-widest mb-3">
            {myPicks.length === 0 ? 'Pick #1 — will be your captain' : 'Pick #2'}
          </p>
          <SectionedPlayerList
            players={available}
            onPick={handlePick}
            openSections={openSections}
            onToggleSection={key => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
          />
        </div>
      )}

      {picksDone && (
        <div className="text-center py-6 rounded-xl border border-green-500/20 bg-green-950/10">
          <p className="text-green-400 font-bold">Entering the game…</p>
        </div>
      )}

      <button onClick={onBack} className="w-full mt-6 text-green-800 text-sm hover:text-green-600 transition-colors">
        Leave
      </button>
    </div>
  )
}

import { SCORING } from '../data/events'
import { PLAYER_COLORS, COLOR_CLASSES } from '../lib/roomUtils'
import CaptainBadge from '../components/CaptainBadge'

export default function MultiplayerResultScreen({ players, gameState, ticker, userId, onHome }) {
  const scores = gameState.scores || {}
  const playerPoints = gameState.playerPoints || {}

  // Sort players by score descending
  const ranked = [...players].sort((a, b) => (scores[b.user_id] ?? 0) - (scores[a.user_id] ?? 0))
  const winner = ranked[0]
  const myRank = ranked.findIndex(p => p.user_id === userId) + 1
  const isWinner = winner?.user_id === userId
  const isDraw = ranked.length > 1 && (scores[ranked[0].user_id] ?? 0) === (scores[ranked[1].user_id] ?? 0)

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Winner banner */}
      <div className={`rounded-2xl border text-center py-8 mb-6 ${
        isDraw ? 'border-green-500/30 bg-green-950/10' :
        isWinner ? 'border-green-500/40 bg-green-950/20' :
        'border-[#1e2b25] bg-[#111815]'
      }`}>
        <div className="text-5xl mb-2">
          {isDraw ? '🤝' : isWinner ? '🏆' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '4️⃣'}
        </div>
        <h2 className={`text-3xl font-black ${isDraw ? 'text-green-400' : isWinner ? 'text-green-300' : 'text-green-600'}`}>
          {isDraw ? 'Draw!' : isWinner ? 'You Win!' : `${winner?.display_name} Wins!`}
        </h2>
        {!isDraw && !isWinner && (
          <p className="text-green-600 text-sm mt-1">You finished #{myRank}</p>
        )}
      </div>

      {/* Leaderboard */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden mb-5">
        <div className="px-4 py-2.5 border-b border-[#1e2b25]">
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Leaderboard</span>
        </div>
        <div className="divide-y divide-[#1e2b25]">
          {ranked.map((p, i) => {
            const color = PLAYER_COLORS[players.findIndex(pl => pl.user_id === p.user_id)] || 'green'
            const cls = COLOR_CLASSES[color]
            const score = scores[p.user_id] ?? 0
            const isMe = p.user_id === userId
            return (
              <div key={p.id} className={`flex items-center gap-4 px-4 py-3 ${i === 0 ? 'bg-green-950/10' : ''}`}>
                <span className={`text-lg font-black w-6 text-center ${i === 0 ? 'text-yellow-400' : 'text-green-700'}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                </span>
                <div className="flex-1">
                  <p className={`font-bold text-sm ${isMe ? 'text-green-200' : 'text-green-100'}`}>
                    {p.display_name} {isMe && <span className="text-green-600 text-xs">(you)</span>}
                  </p>
                  <p className="text-green-700 text-xs">
                    {(p.picks || []).map(fp => fp.name).join(', ')}
                  </p>
                </div>
                <p className={`font-black text-xl ${cls.text}`}>{score}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Per-player breakdown */}
      {ranked.map((p, i) => {
        const color = PLAYER_COLORS[players.findIndex(pl => pl.user_id === p.user_id)] || 'green'
        const cls = COLOR_CLASSES[color]
        return (
          <div key={p.id} className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden mb-3">
            <div className={`px-4 py-2 border-b border-[#1e2b25] ${cls.bg}`}>
              <span className={`text-xs font-bold uppercase tracking-widest ${cls.text}`}>
                {p.display_name} {p.user_id === userId ? '(you)' : ''}
              </span>
            </div>
            <div className="divide-y divide-[#1e2b25]">
              {(p.picks || []).map((fp, pickIdx) => {
                const events = playerPoints[fp.id] || []
                const total = events.reduce((s, e) => s + e.points, 0)
                const isCaptain = pickIdx === 0
                return (
                  <div key={fp.id} className={`px-4 py-3 ${isCaptain ? 'bg-yellow-950/10' : ''}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {isCaptain && <CaptainBadge size="sm" />}
                        <span className="font-bold text-sm text-green-100">{fp.name}</span>
                      </div>
                      <span className={`font-black ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {total > 0 ? '+' : ''}{total}
                      </span>
                    </div>
                    <p className="text-green-700 text-[10px] mb-1">
                      {fp.team} · {fp.position}
                      {isCaptain && <span className="text-yellow-500 ml-1">· Captain 1.5×</span>}
                    </p>
                    {events.length === 0 && <p className="text-green-800 text-[10px]">No events</p>}
                    {events.map((ev, j) => (
                      <div key={j} className={`text-[10px] flex justify-between ${ev.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        <span>{ev.minute}' {SCORING[ev.eventType]?.label}</span>
                        <span className="font-bold">{ev.points > 0 ? '+' : ''}{ev.points}</span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Match recap */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-[#1e2b25]">
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Match Recap</span>
        </div>
        <div className="divide-y divide-[#1e2b25] max-h-48 overflow-y-auto scrollbar-hide">
          {[...(ticker || [])].reverse().map(entry => (
            entry.is_system ? (
              <div key={entry.id} className="px-4 py-2 bg-green-950/10">
                <p className="text-xs text-green-400">{entry.message}</p>
              </div>
            ) : (
              <div key={entry.id} className="px-4 py-2 flex justify-between items-start">
                <div>
                  <span className="text-green-700 text-xs mr-1">{entry.minute}'</span>
                  <span className="text-green-100 text-xs font-semibold">{entry.fantasy_player_name}</span>
                  <span className="text-green-600 text-xs mx-1">·</span>
                  <span className="text-green-500 text-xs">{SCORING[entry.event_type]?.label}</span>
                </div>
                <span className={`text-xs font-black ${entry.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.points > 0 ? '+' : ''}{entry.is_frozen ? 0 : entry.points}
                </span>
              </div>
            )
          ))}
          {(!ticker || ticker.length === 0) && (
            <p className="text-green-800 text-xs text-center py-5">No events recorded</p>
          )}
        </div>
      </div>

      <button onClick={onHome} className="w-full py-3 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] text-sm transition-colors">
        Back to Matches
      </button>
    </div>
  )
}

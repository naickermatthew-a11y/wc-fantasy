import { SCORING } from '../data/events'
import { PLAYERS_BY_MATCH } from '../data/matches'
import CaptainBadge from '../components/CaptainBadge'

export default function ResultScreen({ match, picks, result, onHome }) {
  const { scores, ticker, playerPoints } = result
  const playerWon = scores.player > scores.cpu
  const isDraw = scores.player === scores.cpu

  const allPlayers = PLAYERS_BY_MATCH[match.id] || []

  function getPlayerEvents(player) {
    return playerPoints?.[player.id] || []
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Winner banner */}
      <div className={`rounded-2xl border text-center py-8 mb-6 ${
        isDraw
          ? 'border-green-500/30 bg-green-950/10'
          : playerWon
          ? 'border-green-500/40 bg-green-950/20'
          : 'border-red-500/30 bg-red-950/10'
      }`}>
        <div className="text-5xl mb-2">
          {isDraw ? '🤝' : playerWon ? '🏆' : '😔'}
        </div>
        <h2 className={`font-orbitron text-3xl font-black ${isDraw ? 'text-green-400' : playerWon ? 'text-green-300' : 'text-red-400'}`}
          style={{ textShadow: playerWon ? '0 0 16px rgba(0,255,135,0.5)' : undefined }}>
          {isDraw ? 'Draw!' : playerWon ? 'You Win!' : 'CPU Wins'}
        </h2>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-green-500 text-xs font-bold uppercase tracking-widest">You</p>
            <p className="font-orbitron text-4xl font-black text-green-300">{scores.player}</p>
          </div>
          <div className="text-green-700 text-2xl font-bold">–</div>
          <div className="text-center">
            <p className="text-yellow-500 text-xs font-bold uppercase tracking-widest">CPU</p>
            <p className="font-orbitron text-4xl font-black text-yellow-300">{scores.cpu}</p>
          </div>
        </div>
        <p className="text-green-700 text-xs mt-2">fantasy points</p>
      </div>

      {/* Full point breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <BreakdownColumn
          label="Your Players"
          players={picks.player}
          playerPoints={playerPoints}
          color="green"
        />
        <BreakdownColumn
          label="CPU Players"
          players={picks.cpu}
          playerPoints={playerPoints}
          color="yellow"
        />
      </div>

      {/* Match recap ticker */}
      <div className="rounded-2xl border border-[#1e2b25] bg-[#111815] overflow-hidden mb-6">
        <div className="px-4 py-2.5 border-b border-[#1e2b25]">
          <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Match Recap</span>
        </div>
        <div className="divide-y divide-[#1e2b25] max-h-60 overflow-y-auto scrollbar-hide">
          {[...(ticker || [])].reverse().map(entry => (
            entry.system ? (
              <div key={entry.id} className="px-4 py-2 bg-green-950/10">
                <p className="text-xs text-green-400">{entry.message}</p>
              </div>
            ) : (
              <div key={entry.id} className="px-4 py-2 flex justify-between items-start">
                <div>
                  <span className="text-green-700 text-xs mr-1">{entry.minute}'</span>
                  <span className="text-green-100 text-xs font-semibold">{entry.player}</span>
                  <span className="text-green-600 text-xs mx-1">·</span>
                  <span className="text-green-500 text-xs">{SCORING[entry.eventType]?.label}</span>
                </div>
                <span className={`text-xs font-black ${entry.points >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {entry.points > 0 ? '+' : ''}{entry.frozen ? 0 : entry.points}
                </span>
              </div>
            )
          ))}
          {(!ticker || ticker.length === 0) && (
            <p className="text-green-800 text-xs text-center py-6">No events recorded</p>
          )}
        </div>
      </div>

      <button
        onClick={onHome}
        className="w-full py-3 rounded-xl font-bold bg-green-500 hover:bg-green-400 text-[#0a0f0d] text-sm transition-colors active:scale-95"
      >
        Back to Matches
      </button>
    </div>
  )
}

function BreakdownColumn({ label, players, playerPoints, color }) {
  return (
    <div>
      <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${color === 'green' ? 'text-green-400' : 'text-yellow-400'}`}>
        {label}
      </p>
      <div className="space-y-2">
        {players.map((player, i) => {
          const events = playerPoints?.[player.id] || []
          const total = events.reduce((s, e) => s + e.points, 0)
          const isCaptain = i === 0
          return (
            <div
              key={player.id}
              className={`rounded-xl border px-3 py-2.5 ${
                isCaptain
                  ? 'border-yellow-500/30 bg-yellow-950/10'
                  : color === 'green'
                  ? 'border-green-500/20 bg-green-950/10'
                  : 'border-yellow-500/20 bg-yellow-950/10'
              }`}
            >
              <div className="flex justify-between items-center mb-1.5">
                <div className="flex items-center gap-1.5">
                  {isCaptain && <CaptainBadge size="sm" />}
                  <span className="font-bold text-sm text-green-100">{player.name}</span>
                </div>
                <span className={`font-black text-base ${total >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {total > 0 ? '+' : ''}{total}
                </span>
              </div>
              <p className="text-green-700 text-[10px] mb-1.5">
                {player.team} · {player.position}
                {isCaptain && <span className="text-yellow-500 ml-1">· Captain 1.5×</span>}
              </p>
              {events.length === 0 && (
                <p className="text-green-800 text-[10px]">No events</p>
              )}
              {events.map((ev, i) => (
                <div key={i} className={`text-[10px] flex justify-between ${ev.points >= 0 ? 'text-green-600' : 'text-red-500'}`}>
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
}

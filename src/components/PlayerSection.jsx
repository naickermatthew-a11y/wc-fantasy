// Shared player list components used by both DraftScreen and MultiplayerDraftScreen.

const SECTION_DEFS = [
  { key: 'defence',  label: 'DEFENCE',  positions: new Set(['GK', 'DEF']) },
  { key: 'midfield', label: 'MIDFIELD', positions: new Set(['MID']) },
  { key: 'attack',   label: 'ATTACK',   positions: new Set(['FWD']) },
]

const SECTION_COLORS = {
  DEFENCE:  { text: 'text-blue-400',   badge: 'text-blue-500 bg-blue-500/10',    line: 'bg-blue-900/30'   },
  MIDFIELD: { text: 'text-purple-400', badge: 'text-purple-500 bg-purple-500/10', line: 'bg-purple-900/30' },
  ATTACK:   { text: 'text-red-400',    badge: 'text-red-500 bg-red-500/10',      line: 'bg-red-900/30'    },
}

// Full 3-section collapsible player list.
// openSections: { defence: bool, midfield: bool, attack: bool }
// onToggleSection: (key) => void
export function SectionedPlayerList({ players, onPick, urgent = false, openSections, onToggleSection }) {
  return (
    <div>
      {SECTION_DEFS.map(({ key, label, positions }) => {
        const sectionPlayers = players.filter(p => positions.has(p.position))
        if (sectionPlayers.length === 0) return null
        return (
          <PlayerSection
            key={key}
            label={label}
            players={sectionPlayers}
            open={openSections[key]}
            onToggle={() => onToggleSection(key)}
            onPick={onPick}
            urgent={urgent}
          />
        )
      })}
    </div>
  )
}

export function PlayerSection({ label, players, open, onToggle, onPick, urgent }) {
  const colors = SECTION_COLORS[label] || { text: 'text-green-400', badge: 'text-green-500 bg-green-500/10', line: 'bg-green-900/30' }
  return (
    <div className="mb-2">
      <button onClick={onToggle} className="w-full flex items-center gap-2 py-1.5 mb-1 group">
        <span className={`text-[11px] font-black uppercase tracking-widest ${colors.text}`}>{label}</span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${colors.badge}`}>{players.length}</span>
        <div className={`flex-1 h-px ${colors.line}`} />
        <svg
          viewBox="0 0 12 12"
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${colors.text} ${open ? '' : '-rotate-90'}`}
          fill="currentColor"
        >
          <path d="M6 8.5L1 3.5h10L6 8.5z" />
        </svg>
      </button>
      {open && (
        <div className="space-y-2">
          {players.map(player => (
            <PlayerCard key={player.id} player={player} onPick={() => onPick(player)} urgent={urgent} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PlayerCard({ player, onPick, urgent }) {
  const posColors = { GK: 'text-amber-400', DEF: 'text-blue-400', MID: 'text-purple-400', FWD: 'text-red-400' }
  return (
    <button
      onClick={onPick}
      className={`w-full flex items-center justify-between rounded-xl border bg-[#111815] px-3 py-2.5 transition-all active:scale-[0.98] ${
        urgent
          ? 'border-red-500/30 hover:border-red-400/60 hover:bg-red-950/10'
          : 'border-[#1e2b25] hover:border-green-500/50 hover:bg-green-950/10'
      }`}
    >
      <div className="text-left">
        <p className="font-semibold text-sm text-green-100">{player.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <p className="text-xs text-green-600">{player.team}</p>
          {(player.isEstSquad || player.isPlaceholder) && (
            <span className="text-[9px] font-bold text-gray-500 bg-gray-500/10 border border-gray-500/20 px-1 py-px rounded">
              Est. Squad
            </span>
          )}
        </div>
      </div>
      <span className={`text-xs font-bold ${posColors[player.position] || 'text-green-400'}`}>
        {player.position}
      </span>
    </button>
  )
}

// Lineup confirmation status badge — shown in both draft screens when match is an API fixture.
export function LineupStatusBadge({ match, lineupConfirmed, checkingLineup, nextCheckSecs }) {
  if (!match?.isApiMatch) return null
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${
      lineupConfirmed ? 'text-green-500 bg-green-500/10' : 'text-amber-400 bg-amber-400/10'
    }`}>
      {checkingLineup ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
          Checking lineup…
        </>
      ) : lineupConfirmed ? (
        <>✓ Official lineup</>
      ) : (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block opacity-60" />
          {nextCheckSecs !== null
            ? `Refresh in ${Math.floor(nextCheckSecs / 60)}m ${nextCheckSecs % 60}s`
            : 'Awaiting lineup'}
        </>
      )}
    </span>
  )
}

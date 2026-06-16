import { useState, useEffect } from 'react'
import { MATCHES } from '../data/matches'
import { isSupabaseConfigured } from '../lib/supabase'
import { isApiFootballConfigured, fetchWCFixtures } from '../lib/apiFootball'
import FlagImg from '../components/FlagImg'

export default function HomeScreen({ onStart, onMultiplayer }) {
  const multiplayerEnabled = isSupabaseConfigured()
  // Start with empty list — API is the source of truth. Hardcoded MATCHES are fallback only.
  const [matches, setMatches] = useState(isApiFootballConfigured() ? [] : MATCHES)
  const [loading, setLoading] = useState(isApiFootballConfigured())
  const [usingLiveData, setUsingLiveData] = useState(false)

  useEffect(() => {
    if (!isApiFootballConfigured()) return
    let cancelled = false

    fetchWCFixtures()
      .then(fixtures => {
        if (cancelled) return

        console.log('[HomeScreen] raw API fixtures:', fixtures.length, fixtures.map(f =>
          `[${f.id}] ${f.home.name} vs ${f.away.name} | ${f.status}${f.status === 'LIVE' ? ` ${f.minute}'` : ''} | ${f.date} | ${f.venue}`
        ))

        // API is primary. Hardcoded MATCHES entries fill in any real fixtures the API
        // window missed (e.g. yesterday's match already marked FT before our from= date).
        const apiById = {}
        for (const f of fixtures) apiById[f.id] = f

        const fallbacks = MATCHES.filter(m => !apiById[m.id])
        const STATUS_ORDER = { LIVE: 0, UPCOMING: 1, FT: 2 }
        const merged = [...fixtures, ...fallbacks].sort(
          (a, b) => (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1)
        )
        setMatches(merged.length > 0 ? merged : MATCHES)
        setUsingLiveData(true)
      })
      .catch(err => {
        console.warn('[HomeScreen] API-Football unavailable, using static data:', err.message)
        if (!cancelled) setMatches(MATCHES)
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [])

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="relative text-center mb-8 py-6 rounded-2xl overflow-hidden">
        {/* Scanlines overlay */}
        <div className="absolute inset-0 scanlines pointer-events-none opacity-50" />
        <div className="relative z-10">
          <div className="text-5xl mb-3">⚽</div>
          <h1 className="font-orbitron text-3xl font-black tracking-tight text-green-400"
            style={{ textShadow: '0 0 20px rgba(0,255,135,0.5)' }}>
            WC Fantasy
          </h1>
          <p className="text-green-600 text-sm mt-1 font-medium tracking-widest uppercase">2026 FIFA World Cup</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <div className="rounded-xl border border-green-500/40 bg-green-950/20 px-3 py-2.5 text-center">
          <p className="text-green-400 font-bold text-sm">⚡ Solo vs CPU</p>
          <p className="text-green-700 text-xs mt-0.5">Pick any match below</p>
        </div>
        <button
          onClick={multiplayerEnabled ? undefined : null}
          disabled={!multiplayerEnabled}
          className={`rounded-xl border px-3 py-2.5 text-center transition-colors ${
            multiplayerEnabled
              ? 'border-purple-500/40 bg-purple-950/20 hover:bg-purple-950/30 cursor-default'
              : 'border-[#1e2b25] bg-[#111815] opacity-50 cursor-not-allowed'
          }`}
        >
          <p className="text-purple-400 font-bold text-sm">🌐 Multiplayer</p>
          <p className="text-green-700 text-xs mt-0.5">
            {multiplayerEnabled ? 'Choose match → tap 🌐' : 'Set up Supabase env'}
          </p>
        </button>
      </div>

      {/* Live data badge */}
      {usingLiveData && (
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          <span className="text-green-600 text-xs font-medium tracking-wide">Live WC 2026 data</span>
        </div>
      )}

      {/* Match list */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-[#1e2b25] bg-[#111815] p-4 animate-pulse">
              <div className="h-4 bg-green-900/30 rounded mb-3 w-20" />
              <div className="flex justify-between items-center mb-3">
                <div className="h-6 bg-green-900/20 rounded w-28" />
                <div className="h-6 bg-green-900/20 rounded w-10" />
                <div className="h-6 bg-green-900/20 rounded w-28" />
              </div>
              <div className="h-3 bg-green-900/20 rounded w-40 mb-4" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-9 bg-green-900/20 rounded-xl" />
                <div className="h-9 bg-green-900/20 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(match => (
            <MatchCard key={match.id} match={match} onStart={onStart} onMultiplayer={multiplayerEnabled ? onMultiplayer : null} />
          ))}
        </div>
      )}

      <p className="text-center text-green-800 text-xs mt-10">
        Solo mode vs CPU · No account needed
      </p>
    </div>
  )
}

function MatchCard({ match, onStart, onMultiplayer }) {
  const isLive = match.status === 'LIVE'
  const isFT = match.status === 'FT'
  const showScore = isLive || isFT

  return (
    <div className={`rounded-2xl border p-4 ${
      isLive ? 'border-green-500/40 bg-green-950/20' :
      isFT   ? 'border-[#1e2b25] bg-[#0d1410] opacity-75' :
               'border-[#1e2b25] bg-[#111815]'
    }`}>
      {/* Status bar */}
      <div className="flex items-center gap-2 mb-3">
        {isLive ? (
          <>
            <span className="flex items-center gap-1.5 text-xs font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full live-badge-glow">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              LIVE
            </span>
            <span className="text-green-600 text-xs font-medium">{match.minute}'</span>
          </>
        ) : isFT ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-green-700 bg-green-900/20 px-2 py-0.5 rounded-full">
              FULL TIME
            </span>
            {match.kickoff && (
              <span className="text-xs text-green-800">{match.kickoff.split(' · ').slice(0, 2).join(' ')}</span>
            )}
          </div>
        ) : (
          <span className="text-xs font-medium text-green-700 bg-green-900/20 px-2 py-0.5 rounded-full">
            {match.kickoff ? `UPCOMING · ${match.kickoff}` : 'UPCOMING'}
          </span>
        )}
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-between mb-1">
        <TeamRow team={match.home} />
        <div className="text-center px-3">
          {showScore ? (
            <span className={`text-2xl font-black ${isFT ? 'text-green-700' : 'text-white'}`}>
              {match.homeScore}–{match.awayScore}
            </span>
          ) : (
            <span className="text-green-700 font-bold text-sm">VS</span>
          )}
        </div>
        <TeamRow team={match.away} right />
      </div>

      <p className="text-green-800 text-xs mb-4">📍 {match.venue}</p>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onStart(match)}
          className="py-2.5 rounded-xl font-bold text-sm bg-green-500 hover:bg-green-400 text-[#0a0f0d] transition-colors active:scale-95"
        >
          {isFT ? '🔁 Replay' : '⚡ vs CPU'}
        </button>
        {onMultiplayer ? (
          <button
            onClick={() => onMultiplayer(match)}
            className="py-2.5 rounded-xl font-bold text-sm border border-purple-500/50 text-purple-400 hover:bg-purple-950/20 transition-colors active:scale-95"
          >
            🌐 Multiplayer
          </button>
        ) : (
          <div className="py-2.5 rounded-xl font-bold text-sm border border-[#1e2b25] text-green-800 text-center cursor-not-allowed">
            🌐 MP
          </div>
        )}
      </div>
    </div>
  )
}

function TeamRow({ team, right }) {
  return (
    <div className={`flex items-center gap-2 flex-1 ${right ? 'flex-row-reverse' : ''}`}>
      <FlagImg code={team.flag} name={team.name} size="lg" className="flex-shrink-0" />
      <div className={right ? 'text-right' : ''}>
        <p className="font-bold text-sm text-green-100">{team.name}</p>
        <p className="text-green-700 text-xs">{team.code}</p>
      </div>
    </div>
  )
}

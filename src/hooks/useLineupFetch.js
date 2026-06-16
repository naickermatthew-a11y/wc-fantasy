import { useState, useEffect, useRef } from 'react'
import { getFallbackPlayers } from '../lib/playerUtils'
import { fetchLineup } from '../lib/apiFootball'

const LINEUP_POLL_MS = 5 * 60 * 1000

// Loads fallback players immediately, then silently upgrades to the official API
// lineup when it becomes available (usually ~60 min before kickoff).
// isDraftStarted: when true, player list is not replaced mid-draft.
export function useLineupFetch(match, isDraftStarted) {
  const [players, setPlayers] = useState(() => getFallbackPlayers(match))
  const [lineupConfirmed, setLineupConfirmed] = useState(!match?.isApiMatch)
  const [checkingLineup, setCheckingLineup] = useState(false)
  const [nextCheckSecs, setNextCheckSecs] = useState(null)

  const isDraftStartedRef = useRef(isDraftStarted)
  isDraftStartedRef.current = isDraftStarted

  // Initial silent fetch on mount
  useEffect(() => {
    if (!match?.isApiMatch) return
    let cancelled = false
    fetchLineup(match.id)
      .then(lineup => {
        if (cancelled || isDraftStartedRef.current) return
        if (lineup?.length > 0) {
          setPlayers(lineup)
          setLineupConfirmed(true)
          setNextCheckSecs(null)
        }
      })
      .catch(err => console.warn('[useLineupFetch] initial fetch failed:', err.message))
    return () => { cancelled = true }
  }, [match?.id])

  // 5-minute poll until lineup confirmed (or draft already started)
  useEffect(() => {
    if (!match?.isApiMatch || lineupConfirmed) return
    let cancelled = false
    let secsLeft = LINEUP_POLL_MS / 1000
    setNextCheckSecs(secsLeft)

    const countdownTimer = setInterval(() => {
      secsLeft -= 1
      if (!cancelled) setNextCheckSecs(secsLeft <= 0 ? LINEUP_POLL_MS / 1000 : secsLeft)
    }, 1000)

    const poll = async () => {
      if (cancelled) return
      setCheckingLineup(true)
      try {
        const lineup = await fetchLineup(match.id)
        if (cancelled) return
        if (lineup?.length > 0) {
          if (!isDraftStartedRef.current) setPlayers(lineup)
          setLineupConfirmed(true)
          setNextCheckSecs(null)
        }
      } catch (err) {
        console.warn('[useLineupFetch] poll failed:', err.message)
      } finally {
        if (!cancelled) { setCheckingLineup(false); secsLeft = LINEUP_POLL_MS / 1000 }
      }
    }

    const pollTimer = setInterval(poll, LINEUP_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(countdownTimer)
      clearInterval(pollTimer)
    }
  }, [match?.isApiMatch, lineupConfirmed])

  return { players, lineupConfirmed, checkingLineup, nextCheckSecs }
}

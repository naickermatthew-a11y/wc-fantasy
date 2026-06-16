import { useState } from 'react'
import HomeScreen from './screens/HomeScreen'
import DraftScreen from './screens/DraftScreen'
import GameScreen from './screens/GameScreen'
import ResultScreen from './screens/ResultScreen'
import MultiplayerSetupScreen from './screens/MultiplayerSetupScreen'
import LobbyScreen from './screens/LobbyScreen'
import MultiplayerDraftScreen from './screens/MultiplayerDraftScreen'
import MultiplayerGameScreen from './screens/MultiplayerGameScreen'
import MultiplayerResultScreen from './screens/MultiplayerResultScreen'

export default function App() {
  const [screen, setScreen] = useState('home')
  const [gameState, setGameState] = useState(null)

  // ── Solo CPU flow ─────────────────────────────────────────────────────────
  function startSolo(match) {
    setGameState({ match })
    setScreen('draft')
  }

  function onDraftComplete(picks, matchPlayers) {
    setGameState(prev => ({ ...prev, picks, matchPlayers }))
    setScreen('game')
  }

  function onGameEnd(result) {
    setGameState(prev => ({ ...prev, result }))
    setScreen('result')
  }

  // ── Multiplayer flow ──────────────────────────────────────────────────────
  function startMultiplayer(match) {
    setGameState({ match })
    setScreen('mp-setup')
  }

  function onRoomCreated(roomInfo) {
    setGameState(prev => ({ ...prev, roomInfo }))
    setScreen('mp-lobby')
  }

  function onRoomJoined(roomInfo) {
    setGameState(prev => ({ ...prev, roomInfo }))
    setScreen('mp-lobby')
  }

  function onLobbyStart({ room, players }) {
    setGameState(prev => ({ ...prev, room, players }))
    setScreen('mp-draft')
  }

  function onMpDraftComplete({ room, players }) {
    setGameState(prev => ({ ...prev, room, players }))
    setScreen('mp-game')
  }

  function onMpGameEnd({ room, players, gameState: gs, ticker }) {
    setGameState(prev => ({ ...prev, room, players, mpGameState: gs, mpTicker: ticker }))
    setScreen('mp-result')
  }

  function goHome() {
    setScreen('home')
    setGameState(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0f0d] text-green-50">
      {screen === 'home' && (
        <HomeScreen onStart={startSolo} onMultiplayer={startMultiplayer} />
      )}

      {/* ── Solo screens ── */}
      {screen === 'draft' && (
        <DraftScreen match={gameState.match} onComplete={onDraftComplete} />
      )}
      {screen === 'game' && (
        <GameScreen
          match={gameState.match}
          picks={gameState.picks}
          allMatchPlayers={gameState.matchPlayers}
          onEnd={onGameEnd}
        />
      )}
      {screen === 'result' && (
        <ResultScreen
          match={gameState.match}
          picks={gameState.picks}
          result={gameState.result}
          onHome={goHome}
        />
      )}

      {/* ── Multiplayer screens ── */}
      {screen === 'mp-setup' && (
        <MultiplayerSetupScreen
          match={gameState.match}
          onRoomCreated={onRoomCreated}
          onRoomJoined={onRoomJoined}
          onBack={goHome}
        />
      )}
      {screen === 'mp-lobby' && (
        <LobbyScreen
          roomInfo={gameState.roomInfo}
          onStart={onLobbyStart}
          onBack={goHome}
        />
      )}
      {screen === 'mp-draft' && (
        <MultiplayerDraftScreen
          roomInfo={gameState.roomInfo}
          room={gameState.room}
          players={gameState.players}
          match={gameState.match}
          onComplete={onMpDraftComplete}
        />
      )}
      {screen === 'mp-game' && (
        <MultiplayerGameScreen
          roomInfo={gameState.roomInfo}
          room={gameState.room}
          players={gameState.players}
          match={gameState.match}
          onEnd={onMpGameEnd}
        />
      )}
      {screen === 'mp-result' && (
        <MultiplayerResultScreen
          players={gameState.players}
          gameState={gameState.mpGameState || {}}
          ticker={gameState.mpTicker || []}
          userId={gameState.roomInfo?.userId}
          onHome={goHome}
        />
      )}
    </div>
  )
}

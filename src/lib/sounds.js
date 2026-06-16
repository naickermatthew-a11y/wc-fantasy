let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function playTick(isLast = false) {
  try {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    // Higher pitch and slightly louder for the final second
    osc.type = 'sine'
    osc.frequency.value = isLast ? 1100 : 880
    gain.gain.setValueAtTime(isLast ? 0.45 : 0.28, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.09)
  } catch {
    // Audio API not available — silently ignore
  }
}

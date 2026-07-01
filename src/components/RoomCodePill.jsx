import { useState } from 'react'

export default function RoomCodePill({ code }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <button
      onClick={handleCopy}
      title="Tap to copy room code"
      className="fixed top-3 right-3 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0d1610] border border-green-500/25 hover:border-green-500/60 active:scale-95 transition-all shadow-sm"
    >
      <span className="text-green-700 text-[10px] font-semibold uppercase tracking-wider">Room</span>
      <span className="text-green-200 text-xs font-black tracking-[0.15em]">{code}</span>
      {copied && <span className="text-green-400 text-[10px] font-bold">✓</span>}
    </button>
  )
}

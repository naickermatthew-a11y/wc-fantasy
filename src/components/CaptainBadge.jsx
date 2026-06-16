export default function CaptainBadge({ size = 'md' }) {
  const cls = size === 'sm'
    ? 'w-3.5 h-3.5 text-[8px]'
    : size === 'lg'
    ? 'w-6 h-6 text-xs'
    : 'w-4.5 h-4.5 text-[9px]'

  return (
    <span
      title="Captain — 1.5× points"
      className={`inline-flex items-center justify-center rounded-full bg-yellow-400 text-[#0a0f0d] font-black flex-shrink-0 ${cls}`}
      style={{ width: size === 'sm' ? 14 : size === 'lg' ? 24 : 18, height: size === 'sm' ? 14 : size === 'lg' ? 24 : 18 }}
    >
      C
    </span>
  )
}

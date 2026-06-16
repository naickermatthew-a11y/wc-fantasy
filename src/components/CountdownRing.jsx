const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 188.5

export default function CountdownRing({ seconds, total = 30, size = 76 }) {
  const progress = Math.max(0, seconds) / total
  const offset = CIRCUMFERENCE * (1 - progress)

  const isUrgent = seconds <= 10
  const isCritical = seconds <= 5

  const ringColor = isCritical ? '#ef4444' : isUrgent ? '#f97316' : '#22c55e'
  const textColor = isCritical
    ? 'text-red-400'
    : isUrgent
    ? 'text-orange-400'
    : 'text-green-400'

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 76 76"
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx="38" cy="38" r={RADIUS}
          fill="none"
          stroke="#1a2820"
          strokeWidth="5"
        />
        {/* Animated arc */}
        <circle
          cx="38" cy="38" r={RADIUS}
          fill="none"
          stroke={ringColor}
          strokeWidth="5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.4s ease' }}
        />
      </svg>

      {/* Number */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-black tabular-nums leading-none ${textColor} ${isCritical ? 'animate-pulse' : ''}`}>
          {Math.max(0, seconds)}
        </span>
      </div>
    </div>
  )
}

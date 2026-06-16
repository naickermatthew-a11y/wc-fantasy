// Renders a country flag from flagcdn.com using the ISO 3166-1 alpha-2 code.
// The `code` prop is a lowercase string like 'qa', 'ch', 'gb-eng'.
// Falls back to a neutral placeholder if code is missing or the image 404s.
export default function FlagImg({ code, name = '', size = 'md', className = '' }) {
  const dimensions = {
    sm: { w: 20, h: 14 },
    md: { w: 28, h: 20 },
    lg: { w: 40, h: 28 },
  }
  const { w, h } = dimensions[size] || dimensions.md

  if (!code) {
    return (
      <span
        className={`inline-block rounded-sm bg-green-900/40 border border-green-800/30 ${className}`}
        style={{ width: w, height: h }}
        title={name}
      />
    )
  }

  return (
    <img
      src={`https://flagcdn.com/w${w * 2}/${code}.png`}
      srcSet={`https://flagcdn.com/w${w * 2}/${code}.png 2x`}
      width={w}
      height={h}
      alt={name}
      title={name}
      className={`inline-block rounded-sm object-cover ${className}`}
      onError={e => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

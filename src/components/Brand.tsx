import { BRAND } from '../lib/ui'

export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.42} height={size * 0.42} aria-hidden>
        <path d="M8 5.5v13l10.5-6.5z" fill="#fff" />
      </svg>
    </span>
  )
}

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="brand">
      <BrandMark />
      <div className="brand-text">
        <strong>{BRAND}</strong>
        <span>{sub ?? 'Mentörlük Paneli'}</span>
      </div>
    </div>
  )
}

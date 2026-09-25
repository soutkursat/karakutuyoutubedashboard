import { THEMES, setTheme, useTheme } from '../lib/theme'
import { cx } from '../lib/ui'
import { IconCheck } from './Icons'

/** Tema seçici: profil sayfasında büyük, kullanıcı menüsünde küçük */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const current = useTheme()
  return (
    <div className={cx('theme-picker', compact && 'compact')} role="radiogroup" aria-label="Tema">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={current === t.id}
          className={cx('theme-opt', current === t.id && 'active')}
          onClick={() => setTheme(t.id)}
        >
          <span className={`theme-sw theme-sw-${t.id}`} style={{ background: t.swatch }}>
            {current === t.id && <IconCheck size={compact ? 12 : 14} />}
          </span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Tema: sadece renkler değişir (efektler, yerleşim aynı). Seçim bu cihazda saklanır.
 * CSS tarafı: styles.css → :root[data-theme='blue' | 'mono']
 */
import { useSyncExternalStore } from 'react'

export type ThemeId = 'red' | 'blue' | 'mono'

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: 'red', label: 'Kırmızı', swatch: 'linear-gradient(135deg, #ff3a4f, #ff7a2f)' },
  { id: 'blue', label: 'Mavi', swatch: 'linear-gradient(135deg, #3a8bff, #2fd0ff)' },
  { id: 'mono', label: 'Beyaz', swatch: 'linear-gradient(135deg, #ffffff, #a1a1aa)' },
]

const KEY = 'kk.theme'
const listeners = new Set<() => void>()

export function getTheme(): ThemeId {
  let v: string | null = null
  try {
    v = localStorage.getItem(KEY)
  } catch {
    /* gizli sekme vb. */
  }
  return v === 'blue' || v === 'mono' ? v : 'red'
}

export function applyTheme(t: ThemeId = getTheme()) {
  if (t === 'red') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

export function setTheme(t: ThemeId) {
  try {
    localStorage.setItem(KEY, t)
  } catch {
    /* kaydedilemese de bu oturumda uygula */
  }
  applyTheme(t)
  listeners.forEach((l) => l())
}

export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => document.documentElement.dataset.theme === 'blue' || document.documentElement.dataset.theme === 'mono'
      ? (document.documentElement.dataset.theme as ThemeId)
      : 'red',
  )
}

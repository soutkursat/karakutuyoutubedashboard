// localStorage erişimini güvenli hale getirir (gizli sekme / dolu depolama / bozuk JSON).
const cache = new Map<string, { raw: string | null; value: unknown }>()

export function read<T>(key: string, fallback: T): T {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(key)
  } catch {
    return fallback
  }
  const hit = cache.get(key)
  if (hit && hit.raw === raw) return hit.value as T
  let value: T = fallback
  if (raw != null) {
    try {
      value = JSON.parse(raw) as T
    } catch {
      value = fallback
    }
  }
  cache.set(key, { raw, value })
  return value
}

export function write<T>(key: string, value: T): void {
  const raw = JSON.stringify(value)
  try {
    localStorage.setItem(key, raw)
  } catch {
    throw new Error('Veri kaydedilemedi. Tarayıcı depolaması dolu ya da engellenmiş olabilir.')
  }
  cache.set(key, { raw, value })
  emit()
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* yok say */
  }
  cache.delete(key)
  emit()
}

// --- Basit abonelik sistemi: veri değişince React bileşenleri yeniden çizilir ---
let version = 0
const listeners = new Set<() => void>()
export function emit() {
  version++
  listeners.forEach((l) => l())
}
export function subscribe(l: () => void) {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
export const getVersion = () => version

// Başka sekmede yapılan değişiklikleri de yakala (ör. admin ve öğrenci aynı tarayıcıda)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.startsWith('kk.')) emit()
  })
}

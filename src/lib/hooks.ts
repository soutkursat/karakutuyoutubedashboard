import { useEffect, useState, useSyncExternalStore } from 'react'
import { getVersion, subscribe } from './storage'

/** Veri değişince bileşeni yeniden çizer. */
export function useDataVersion() {
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}

/** Belirli aralıklarla güncellenen "şu an" (geçmiş slotlar otomatik kaybolsun). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

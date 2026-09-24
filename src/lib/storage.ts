// Basit abonelik sistemi: veri önbelleği değişince React bileşenleri yeniden çizilir.
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

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { IconCheck, IconX } from './Icons'

type Kind = 'success' | 'error' | 'info'
interface Toast { id: number; kind: Kind; text: string }

const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {})
export const useToast = () => useContext(Ctx)

let seq = 0
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Kind = 'success') => {
    const id = ++seq
    setItems((s) => [...s.slice(-3), { id, kind, text }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 3200)
  }, [])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast glass toast-${t.kind}`}>
            <span className="toast-ic">{t.kind === 'error' ? <IconX size={14} /> : <IconCheck size={14} />}</span>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

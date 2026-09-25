import { IconWhatsapp } from './Icons'
import { currentUser, getSettings } from '../lib/db'
import { openWhatsapp, questionMessage, waLink } from '../lib/whatsapp'
import { cx } from '../lib/ui'

/** Öğrenci → mentöre WhatsApp'tan soru sor (hazır mesajla) */
export function AskWhatsappButton({ className, label = 'WhatsApp’tan sor' }: { className?: string; label?: string }) {
  const ask = () => {
    const me = currentUser()
    if (me) openWhatsapp(waLink(getSettings().whatsappNumber, questionMessage(me)))
  }
  return (
    <button type="button" className={cx('btn btn-wa', className)} onClick={ask}>
      <IconWhatsapp size={18} /> {label}
    </button>
  )
}

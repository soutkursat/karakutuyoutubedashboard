import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { IconVideo } from './Icons'
import { getGoogleStatus, loadGoogleStatus } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import { formatDate } from '../lib/time'

/**
 * Yönetici: Google bağlantısı koptuysa (ya da yakında kopacaksa) Genel Bakış / Randevular'da uyarı.
 * Bağlantı yokken yeni randevulara otomatik Meet linki oluşmaz; bunu fark etmeden günler geçmesin.
 */
export function GoogleAlert() {
  useDataVersion()
  const g = getGoogleStatus()
  useEffect(() => {
    void loadGoogleStatus()
  }, [])
  if (!g || !g.configured) return null
  const soon = g.connected && g.refreshExpiresAt && new Date(g.refreshExpiresAt).getTime() - Date.now() < 3 * 86400_000
  if (g.connected && !soon) return null
  return (
    <div className="notice notice-danger google-alert">
      <IconVideo size={18} />
      <span>
        {g.connected
          ? `Google Takvim bağlantısı ${formatDate(g.refreshExpiresAt!)} tarihinde kopacak (uygulama Test modunda).`
          : 'Google Takvim bağlı değil: yeni randevulara otomatik Meet linki oluşturulmuyor.'}
      </span>
      <Link className="btn btn-ghost btn-sm" to="/yonetim/musaitlik">
        {g.connected ? 'Nasıl düzeltilir?' : 'Tekrar bağla'}
      </Link>
    </div>
  )
}

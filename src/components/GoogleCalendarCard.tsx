import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconCalendar, IconCheck, IconLink, IconVideo } from './Icons'
import { useToast } from './Toast'
import { getGoogleLoadError, getGoogleStatus, googleConnect, googleDisconnect, googleSyncNow, loadGoogleStatus } from '../lib/db'
import { useDataVersion, useNow } from '../lib/hooks'
import { formatDate, relativeFromNow } from '../lib/time'
import { errMsg } from '../lib/ui'

/** Yönetici: Google Takvim bağlantısı (randevuları otomatik Meet linkiyle takvime ekler; müsaitlik okunmaz) */
export function GoogleCalendarCard() {
  useDataVersion()
  const now = useNow(30_000)
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const g = getGoogleStatus()
  const loadError = getGoogleLoadError()

  useEffect(() => {
    void loadGoogleStatus()
  }, [])

  // Google izin ekranından dönüş
  useEffect(() => {
    const r = params.get('google')
    if (!r) return
    if (r === 'connected') toast('Google Takvim bağlandı')
    else if (r === 'connected_testing') toast('Google Takvim bağlandı, ama Google uygulaman Test modunda: bağlantı 7 gün sonra kopacak.', 'error')
    else toast(`Google bağlantısı başarısız: ${params.get('msg') ?? 'bilinmeyen hata'}`, 'error')
    params.delete('google')
    params.delete('msg')
    setParams(params, { replace: true })
  }, [params, setParams, toast])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      if (ok) toast(ok)
    } catch (e) {
      toast(errMsg(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card glass gcal">
      <div className="card-title-row">
        <h3 className="card-title">
          <IconCalendar size={18} /> Google Takvim
        </h3>
        {g?.connected ? (
          <span className="badge badge-confirmed"><IconCheck size={12} />&nbsp;Bağlı</span>
        ) : (
          <span className="badge badge-pending">Bağlı değil</span>
        )}
      </div>

      {!g && !loadError && <p className="muted">Durum yükleniyor…</p>}
      {loadError && <div className="notice">{loadError}</div>}

      {g && !g.configured && (
        <div className="notice notice-warn">
          <div>
            Google anahtarları eksik. Vercel’e <code>GOOGLE_CLIENT_ID</code> ve <code>GOOGLE_CLIENT_SECRET</code> ekleyip yeniden
            deploy et. Google Console’a yazılacak yönlendirme adresi:
            <code className="code-inline">{g.redirectUri}</code>
          </div>
        </div>
      )}

      {g?.configured && !g.connected && (
        <>
          <ul className="gcal-list">
            <li><IconVideo size={16} /><span>Her randevuya <strong>otomatik Google Meet linki</strong> oluşturulur.</span></li>
            <li><IconCalendar size={16} /><span>Randevular Google Takvimine de eklenir; müsaitliğin yine bu sayfadaki programdan gelir.</span></li>
            <li><IconCheck size={16} /><span>Randevuyu onaylayınca öğrenciye Google davet e-postası gider.</span></li>
          </ul>
          {g.lastError && <div className="notice notice-warn">{g.lastError}</div>}
          <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run(googleConnect)}>
            <IconLink size={16} /> Google hesabımı bağla
          </button>
        </>
      )}

      {g?.connected && (
        <>
          <div className="gcal-acc">
            <span className="gcal-dot" />
            <div>
              <strong>{g.email ?? 'Google hesabı'}</strong>
              <span className="muted">
                {g.lastSyncedAt ? `Son senkron: ${relativeFromNow(g.lastSyncedAt, now)}` : 'Henüz senkron yapılmadı'}
              </span>
            </div>
          </div>
          {g.refreshExpiresAt && (
            <div className="notice notice-warn">
              <div>
                <strong>Bu bağlantı {formatDate(g.refreshExpiresAt)} tarihinde kendiliğinden kopacak.</strong> Google uygulaman “Testing”
                modunda olduğu için Google bağlantıyı 7 günde bir koparıyor. Kalıcı olması için: Google Cloud Console → Google Auth
                Platform → Audience → <strong>Publish app</strong>, ardından burada “Bağlantıyı kaldır” deyip tekrar bağla.
              </div>
            </div>
          )}
          {g.lastError && <div className="notice notice-warn">{g.lastError}</div>}
          <p className="muted small-text">
            Her randevu otomatik Meet linkiyle takvimine eklenir; onayladığında öğrenciye Google davet e-postası gider.
            Müsaitliğin bu sayfadaki programdan gelir, takvimindeki diğer etkinlikler randevu saatlerini etkilemez.
          </p>
          <div className="gcal-actions">
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(googleSyncNow, 'Takvim senkronize edildi')}>
              Şimdi senkronize et
            </button>
            <button
              className="btn btn-text btn-sm danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Google Takvim bağlantısı kaldırılsın mı? Mevcut takvim etkinliklerin silinmez.')) {
                  void run(googleDisconnect, 'Bağlantı kaldırıldı')
                }
              }}
            >
              Bağlantıyı kaldır
            </button>
          </div>
        </>
      )}
    </section>
  )
}

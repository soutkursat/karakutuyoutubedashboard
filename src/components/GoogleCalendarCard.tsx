import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { IconCalendar, IconCheck, IconLink, IconVideo } from './Icons'
import { useToast } from './Toast'
import { getGoogleLoadError, getGoogleStatus, googleConnect, googleDisconnect, googleSyncNow, loadGoogleStatus } from '../lib/db'
import { useDataVersion, useNow } from '../lib/hooks'
import { relativeFromNow } from '../lib/time'
import { errMsg } from '../lib/ui'

/** Yönetici: Google Takvim bağlantısı (dolu saatleri oku + randevuları Meet linkiyle takvime ekle) */
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
            <li><IconCalendar size={16} /><span>Google Takviminde dolu olduğun saatler öğrencilere otomatik kapanır.</span></li>
            <li><IconVideo size={16} /><span>Her randevu takvimine <strong>otomatik Google Meet linkiyle</strong> eklenir.</span></li>
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
          {g.lastError && <div className="notice notice-warn">{g.lastError}</div>}
          <p className="muted small-text">
            Takvimindeki etkinlikler (toplantı, özel iş, tatil) randevu saatlerini otomatik kapatır. “Müsait” olarak işaretli
            etkinlikler engellemez. Senkron her dakika kendiliğinden yenilenir.
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

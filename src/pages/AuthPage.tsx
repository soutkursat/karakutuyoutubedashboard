import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Field, PasswordInput } from '../components/Common'
import { IconArrowRight, IconCalendarPlus, IconVideo, IconWhatsapp } from '../components/Icons'
import { homeFor } from '../components/Guard'
import { currentUser, getSettings, login, register } from '../lib/db'
import { cx, errMsg } from '../lib/ui'

type Tab = 'login' | 'register'

export function AuthPage() {
  const navigate = useNavigate()
  const settings = getSettings()
  const [tab, setTab] = useState<Tab>('login')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ id: '', password: '', name: '', email: '', phone: '', password2: '', invite: '' })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }))

  const me = currentUser()
  if (me) return <Navigate to={homeFor(me)} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      if (tab === 'login') {
        const u = login(f.id, f.password)
        navigate(homeFor(u), { replace: true })
      } else {
        if (f.password !== f.password2) throw new Error('Şifreler birbiriyle eşleşmiyor.')
        register({ name: f.name, email: f.email, phone: f.phone, password: f.password, inviteCode: f.invite })
        navigate('/panel', { replace: true })
      }
    } catch (err) {
      setError(errMsg(err))
    } finally {
      setBusy(false)
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t)
    setError('')
  }

  return (
    <div className="auth">
      <header className="auth-top">
        <Brand />
        <span className="pill-status">
          <i /> Mentörlük randevu sistemi
        </span>
      </header>

      <div className="auth-grid">
        <section className="auth-hero">
          <span className="chip-outline">KARA KUTU YOUTUBE AKADEMİ</span>
          <h1 className="display">
            Mentörlüğünü planla,
            <br />
            <span className="grad-text">kanalını büyüt.</span>
          </h1>
          <p className="lead">
            Müsait saatleri gör, sana uyan saati tek tıkla ayır. Randevun oluştuğunda WhatsApp’tan tek tuşla bize
            bildir, görüşme günü Google Meet linkin panelinde hazır olsun.
          </p>
          <ol className="steps">
            <li><span className="step-n"><IconCalendarPlus size={16} /></span>Saatini seç</li>
            <li><span className="step-n"><IconWhatsapp size={16} /></span>WhatsApp’tan bildir</li>
            <li><span className="step-n"><IconVideo size={16} /></span>Meet’e katıl</li>
          </ol>
        </section>

        <section className="card glass glow auth-card">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'login'} className={cx('tab', tab === 'login' && 'active')} onClick={() => switchTab('login')}>
              Giriş yap
            </button>
            <button role="tab" aria-selected={tab === 'register'} className={cx('tab', tab === 'register' && 'active')} onClick={() => switchTab('register')}>
              Kayıt ol
            </button>
          </div>

          <form onSubmit={submit} className="form" noValidate>
            {tab === 'login' ? (
              <>
                <Field label="E-posta veya kullanıcı adı">
                  <input className="input" autoComplete="username" value={f.id} onChange={set('id')} placeholder="ornek@gmail.com" autoFocus />
                </Field>
                <Field label="Şifre">
                  <PasswordInput autoComplete="current-password" value={f.password} onChange={set('password')} placeholder="••••••" />
                </Field>
              </>
            ) : !settings.registrationOpen ? (
              <div className="notice">Şu an yeni kayıt alınmıyor. Hesabın için bizimle WhatsApp’tan iletişime geç.</div>
            ) : (
              <>
                <Field label="Ad soyad">
                  <input className="input" autoComplete="name" value={f.name} onChange={set('name')} placeholder="Adın Soyadın" />
                </Field>
                <div className="grid-2">
                  <Field label="E-posta">
                    <input className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="ornek@gmail.com" />
                  </Field>
                  <Field label="WhatsApp numarası">
                    <input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} placeholder="0537 000 00 00" />
                  </Field>
                </div>
                <div className="grid-2">
                  <Field label="Şifre" hint="En az 6 karakter">
                    <PasswordInput autoComplete="new-password" value={f.password} onChange={set('password')} />
                  </Field>
                  <Field label="Şifre (tekrar)">
                    <PasswordInput autoComplete="new-password" value={f.password2} onChange={set('password2')} />
                  </Field>
                </div>
                {settings.inviteCode && (
                  <Field label="Davet kodu" hint="Mentörlük kaydında sana iletilen kod">
                    <input className="input" value={f.invite} onChange={set('invite')} />
                  </Field>
                )}
              </>
            )}

            {error && <div className="form-error" role="alert">{error}</div>}

            {(tab === 'login' || settings.registrationOpen) && (
              <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
                {tab === 'login' ? 'Giriş yap' : 'Hesabımı oluştur'} <IconArrowRight size={18} />
              </button>
            )}
          </form>
        </section>
      </div>
    </div>
  )
}

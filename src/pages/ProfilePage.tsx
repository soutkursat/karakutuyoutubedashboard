import { useState, type FormEvent } from 'react'
import { ChannelsCard } from '../components/ChannelsCard'
import { Field, PageHeader, PasswordInput, Switch } from '../components/Common'
import { IconUser } from '../components/Icons'
import { useToast } from '../components/Toast'
import { changePassword, currentUser, updateProfile } from '../lib/db'
import { useDataVersion } from '../lib/hooks'
import { errMsg } from '../lib/ui'
import { formatPhone } from '../lib/validation'

export function ProfilePage() {
  useDataVersion()
  const user = currentUser()!
  const toast = useToast()
  const isStudent = user.role === 'student'
  const [p, setP] = useState({ name: user.name, phone: formatPhone(user.phone), skoolMember: user.skoolMember })
  const [pw, setPw] = useState({ current: '', next: '', next2: '' })
  const [busy, setBusy] = useState(false)

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      await updateProfile(user.id, p)
      toast('Profil kaydedildi')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  const savePw = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      if (pw.next !== pw.next2) throw new Error('Yeni şifreler eşleşmiyor.')
      await changePassword(user.id, pw.current, pw.next)
      setPw({ current: '', next: '', next2: '' })
      toast('Şifren değiştirildi')
    } catch (err) {
      toast(errMsg(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const personal = (
    <form className="card glass profile-personal" onSubmit={saveProfile}>
      <h3 className="card-title"><IconUser size={18} /> Kişisel bilgiler</h3>
      <div className="form">
        {user.role === 'admin' && (
          <Field label="Kullanıcı adı">
            <input className="input" value={user.username} disabled />
          </Field>
        )}
        <Field label="Ad soyad">
          <input className="input" autoComplete="name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
        </Field>
        {isStudent && (
          <Field label="E-posta" hint="E-posta değişikliği için bizimle iletişime geç.">
            <input className="input" type="email" value={user.email} disabled />
          </Field>
        )}
        <Field label={isStudent ? 'Mentörlükte kullandığın WhatsApp numarası' : 'WhatsApp numarası'}>
          <input
            className="input"
            type="tel"
            autoComplete="tel"
            value={p.phone}
            onChange={(e) => setP({ ...p, phone: e.target.value })}
            placeholder="0537 000 00 00"
          />
        </Field>
        {isStudent && (
          <label className="toggle-row">
            <div>
              <strong>Skool topluluğundayım</strong>
              <p className="muted">Skool’a katıldıysan / giriş yaptıysan işaretle.</p>
            </div>
            <Switch checked={p.skoolMember} label="Skool topluluğundayım" onChange={(v) => setP({ ...p, skoolMember: v })} />
          </label>
        )}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </div>
    </form>
  )

  const password = (
    <form className="card glass profile-password" onSubmit={savePw}>
      <h3 className="card-title">Şifre değiştir</h3>
      <div className="form">
        <Field label="Mevcut şifre">
          <PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Yeni şifre" hint="En az 6 karakter">
            <PasswordInput autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
          </Field>
          <Field label="Yeni şifre (tekrar)">
            <PasswordInput autoComplete="new-password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} />
          </Field>
        </div>
        <button className="btn btn-ghost" disabled={busy}>Şifreyi güncelle</button>
      </div>
    </form>
  )

  return (
    <>
      <PageHeader
        eyebrow="Hesap"
        title="Profilim"
        desc={isStudent ? 'Bilgilerin ve kanalların sadece mentörün tarafından görülür.' : 'Hesap bilgilerin.'}
      />
      {isStudent ? (
        <div className="profile-grid">
          {personal}
          <div className="profile-channels">
            <ChannelsCard studentId={user.id} />
          </div>
          {password}
        </div>
      ) : (
        <div className="grid-2 align-start">
          {personal}
          {password}
        </div>
      )}
    </>
  )
}

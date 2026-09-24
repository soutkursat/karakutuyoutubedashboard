import { useState, type FormEvent } from 'react'
import { Field, PageHeader, PasswordInput } from '../components/Common'
import { useToast } from '../components/Toast'
import { changePassword, currentUser, updateProfile } from '../lib/db'
import { errMsg } from '../lib/ui'
import { formatPhone } from '../lib/validation'

export function ProfilePage() {
  const user = currentUser()!
  const toast = useToast()
  const [p, setP] = useState({ name: user.name, email: user.email, phone: formatPhone(user.phone) })
  const [pw, setPw] = useState({ current: '', next: '', next2: '' })

  const saveProfile = (e: FormEvent) => {
    e.preventDefault()
    try {
      updateProfile(user.id, p)
      toast('Profil güncellendi')
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }
  const savePw = (e: FormEvent) => {
    e.preventDefault()
    try {
      if (pw.next !== pw.next2) throw new Error('Yeni şifreler eşleşmiyor.')
      changePassword(user.id, pw.current, pw.next)
      setPw({ current: '', next: '', next2: '' })
      toast('Şifren değiştirildi')
    } catch (err) {
      toast(errMsg(err), 'error')
    }
  }

  return (
    <>
      <PageHeader eyebrow="Hesap" title="Profilim" desc="İletişim bilgilerin randevu bildirimlerinde kullanılır." />
      <div className="grid-2 align-start">
        <form className="card glass" onSubmit={saveProfile}>
          <h3 className="card-title">Kişisel bilgiler</h3>
          <div className="form">
            {user.role === 'admin' && (
              <Field label="Kullanıcı adı">
                <input className="input" value={user.username} disabled />
              </Field>
            )}
            <Field label="Ad soyad">
              <input className="input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            </Field>
            {user.role === 'student' && (
              <Field label="E-posta">
                <input className="input" type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />
              </Field>
            )}
            <Field label="WhatsApp numarası">
              <input className="input" type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
            </Field>
            <button className="btn btn-primary">Kaydet</button>
          </div>
        </form>
        <form className="card glass" onSubmit={savePw}>
          <h3 className="card-title">Şifre değiştir</h3>
          <div className="form">
            <Field label="Mevcut şifre">
              <PasswordInput autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            </Field>
            <Field label="Yeni şifre" hint="En az 6 karakter">
              <PasswordInput autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            </Field>
            <Field label="Yeni şifre (tekrar)">
              <PasswordInput autoComplete="new-password" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} />
            </Field>
            <button className="btn btn-ghost">Şifreyi güncelle</button>
          </div>
        </form>
      </div>
    </>
  )
}

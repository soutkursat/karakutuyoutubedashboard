import { useState } from 'react'
import { Empty, Field, PageHeader, PasswordInput } from '../../components/Common'
import { IconBan, IconCheck, IconEdit, IconPlus, IconSearch, IconTrash, IconUsers, IconWhatsapp } from '../../components/Icons'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toast'
import { adminCreateStudent, adminResetPassword, adminUpdateStudent, deleteStudent, getAppointments, getStudents, setUserStatus } from '../../lib/db'
import { useDataVersion } from '../../lib/hooks'
import { formatDate } from '../../lib/time'
import type { User } from '../../lib/types'
import { cx, errMsg, initials } from '../../lib/ui'
import { formatPhone } from '../../lib/validation'
import { openWhatsapp, waLink } from '../../lib/whatsapp'

const EMPTY = { name: '', email: '', phone: '', password: '', adminNote: '' }

export function AdminStudents() {
  useDataVersion()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [del, setDel] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)

  /** Sunucu işlemi: çift tıklamayı engelle, hatayı göster. Başarılıysa true. */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    if (busy) return false
    setBusy(true)
    try {
      await fn()
      toast(ok)
      return true
    } catch (e) {
      toast(errMsg(e), 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const appts = getAppointments()
  const needle = q.trim().toLocaleLowerCase('tr-TR')
  const students = getStudents()
    .filter((u) => !needle || [u.name, u.email, u.phone].some((v) => v.toLocaleLowerCase('tr-TR').includes(needle)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const open = (u: User | 'new') => {
    setEdit(u)
    setForm(u === 'new' ? EMPTY : { name: u.name, email: u.email, phone: formatPhone(u.phone), password: '', adminNote: u.adminNote ?? '' })
  }

  const save = async () => {
    if (!edit) return
    const ok =
      edit === 'new'
        ? await run(() => adminCreateStudent(form), 'Öğrenci eklendi')
        : await run(async () => {
            await adminUpdateStudent(edit.id, form)
            if (form.password) await adminResetPassword(edit.id, form.password)
          }, 'Öğrenci güncellendi')
    if (ok) setEdit(null)
  }

  const f = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((s) => ({ ...s, [k]: e.target.value }))

  return (
    <>
      <PageHeader
        eyebrow="Yönetim"
        title="Öğrenciler"
        desc={`${getStudents().length} kayıtlı öğrenci`}
        actions={<button className="btn btn-primary" onClick={() => open('new')}><IconPlus size={18} /> Öğrenci ekle</button>}
      />
      <div className="toolbar">
        <div className="search">
          <IconSearch size={16} />
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="İsim, e-posta, telefon…" />
        </div>
      </div>

      {students.length === 0 ? (
        <div className="card glass"><Empty icon={<IconUsers />} title="Öğrenci bulunamadı" /></div>
      ) : (
        <div className="card glass table-card">
          <table className="table">
            <thead>
              <tr><th>Öğrenci</th><th>Telefon</th><th>Randevu</th><th>Kayıt</th><th>Durum</th><th /></tr>
            </thead>
            <tbody>
              {students.map((u) => {
                const mine = appts.filter((a) => a.studentId === u.id)
                return (
                  <tr key={u.id} className={cx(u.status === 'disabled' && 'row-off')}>
                    <td>
                      <div className="user-cell">
                        <span className="avatar sm">{initials(u.name)}</span>
                        <div><strong>{u.name}</strong><span className="muted">{u.email}</span></div>
                      </div>
                    </td>
                    <td className="nowrap">{formatPhone(u.phone)}</td>
                    <td>{mine.filter((a) => a.status === 'completed').length} / {mine.filter((a) => a.status !== 'cancelled').length}</td>
                    <td className="nowrap muted">{formatDate(u.createdAt)}</td>
                    <td><span className={cx('badge', u.status === 'active' ? 'badge-confirmed' : 'badge-cancelled')}>{u.status === 'active' ? 'Aktif' : 'Askıda'}</span></td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title="WhatsApp" onClick={() => openWhatsapp(waLink(u.phone, `Merhaba ${u.name.split(' ')[0]},`))}><IconWhatsapp size={16} /></button>
                        <button className="icon-btn" title="Düzenle" onClick={() => open(u)}><IconEdit size={16} /></button>
                        <button
                          className="icon-btn"
                          title={u.status === 'active' ? 'Askıya al' : 'Aktifleştir'}
                          disabled={busy}
                          onClick={() =>
                            run(
                              () => setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active'),
                              u.status === 'active' ? 'Hesap askıya alındı, gelecek randevuları iptal edildi' : 'Hesap aktifleştirildi',
                            )
                          }
                        >
                          {u.status === 'active' ? <IconBan size={16} /> : <IconCheck size={16} />}
                        </button>
                        <button className="icon-btn danger" title="Sil" onClick={() => setDel(u)}><IconTrash size={16} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit === 'new' ? 'Yeni öğrenci' : 'Öğrenciyi düzenle'}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button></>}
      >
        <div className="form">
          <Field label="Ad soyad"><input className="input" value={form.name} onChange={f('name')} /></Field>
          <div className="grid-2">
            <Field label="E-posta"><input className="input" type="email" value={form.email} onChange={f('email')} /></Field>
            <Field label="Telefon"><input className="input" type="tel" value={form.phone} onChange={f('phone')} /></Field>
          </div>
          <Field label={edit === 'new' ? 'Şifre' : 'Yeni şifre (boş bırakırsan değişmez)'} hint="En az 6 karakter. Öğrenciye WhatsApp’tan iletebilirsin.">
            <PasswordInput autoComplete="new-password" value={form.password} onChange={f('password')} />
          </Field>
          {edit !== 'new' && (
            <Field label="Özel not (sadece sen görürsün)">
              <textarea className="input" rows={3} value={form.adminNote} onChange={f('adminNote')} placeholder="Kanal linki, paket bilgisi, hedefler…" />
            </Field>
          )}
        </div>
      </Modal>

      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Öğrenciyi sil"
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setDel(null)}>Vazgeç</button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                if (!del) return
                if (await run(() => deleteStudent(del.id), 'Öğrenci silindi')) setDel(null)
              }}
            >
              Kalıcı olarak sil
            </button>
          </>
        }
      >
        <p className="muted">
          <strong>{del?.name}</strong> ve tüm randevu geçmişi kalıcı olarak silinecek. Sadece erişimi kesmek istiyorsan “Askıya al”ı kullan.
        </p>
      </Modal>
    </>
  )
}

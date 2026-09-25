/**
 * Vercel sunucu fonksiyonu: POST /api/admin
 * Kullanıcı oluşturma / silme / şifre sıfırlama gibi işlemler Supabase "service role"
 * anahtarı gerektirir. Bu anahtar ASLA tarayıcıya gönderilmez; sadece burada kullanılır.
 * Her istekte çağıranın gerçekten aktif yönetici olduğu doğrulanır.
 */
import { createClient } from '@supabase/supabase-js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const PHONE_RE = /^[0-9]{10,15}$/
const UUID_RE = /^[0-9a-f-]{36}$/i

function authMessage(m: string) {
  if (/already (been )?registered/i.test(m)) return 'Bu e-posta ile kayıtlı bir hesap zaten var.'
  if (/Password should/i.test(m)) return 'Şifre en az 6 karakter olmalı.'
  if (/duplicate key|unique/i.test(m)) return 'Bu telefon numarası başka bir hesapta kayıtlı.'
  if (/Database error/i.test(m)) return 'Kayıt tamamlanamadı. Telefon numarası başka bir hesapta olabilir.'
  return m || 'İşlem başarısız oldu.'
}

export async function POST(request: Request): Promise<Response> {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return json({ error: 'Sunucu ayarları eksik: Vercel’e SUPABASE_SERVICE_ROLE_KEY ekle.' }, 500)

  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Oturum bulunamadı.' }, 401)

  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 1) Çağıran kim? 2) Aktif yönetici mi?
  const { data: caller, error: callerErr } = await sb.auth.getUser(token)
  if (callerErr || !caller.user) return json({ error: 'Oturumun sona erdi. Tekrar giriş yap.' }, 401)
  const { data: me } = await sb.from('profiles').select('role,status').eq('id', caller.user.id).maybeSingle()
  if (!me || me.role !== 'admin' || me.status !== 'active') return json({ error: 'Bu işlem için yetkin yok.' }, 403)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Geçersiz istek.' }, 400)
  }
  const str = (k: string, max = 200) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '')

  // Hedef kullanıcı gerekiyorsa: var mı ve yönetici değil mi?
  const id = str('id', 36)
  const needsTarget = body.action !== 'create'
  if (needsTarget) {
    if (!UUID_RE.test(id)) return json({ error: 'Geçersiz kullanıcı.' }, 400)
    const { data: target } = await sb.from('profiles').select('role').eq('id', id).maybeSingle()
    if (!target) return json({ error: 'Öğrenci bulunamadı.' }, 404)
    if (target.role === 'admin') return json({ error: 'Yönetici hesabı buradan değiştirilemez.' }, 400)
  }

  const password = typeof body.password === 'string' ? body.password : ''
  const name = str('name', 80)
  const email = str('email', 200).toLowerCase()
  const phone = str('phone', 15)

  switch (body.action) {
    case 'create': {
      if (name.length < 3 || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) return json({ error: 'Bilgiler eksik ya da hatalı.' }, 400)
      if (password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı.' }, 400)
      // Kayıt kapalı / davet kodu kurallarını yönetici için atlamak üzere sunucu anahtarı
      const { data: sec } = await sb.from('app_secrets').select('admin_bypass').eq('id', 1).single()
      const { data: created, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, phone, bypass: sec?.admin_bypass },
      })
      if (error) return json({ error: authMessage(error.message) }, 400)
      return json({ ok: true, id: created.user?.id })
    }
    case 'update': {
      if (name.length < 3 || !EMAIL_RE.test(email) || !PHONE_RE.test(phone)) return json({ error: 'Bilgiler eksik ya da hatalı.' }, 400)
      const { data: current } = await sb.auth.admin.getUserById(id)
      if (current.user && current.user.email?.toLowerCase() !== email) {
        const { error } = await sb.auth.admin.updateUserById(id, { email, email_confirm: true })
        if (error) return json({ error: authMessage(error.message) }, 400)
      }
      const { error } = await sb.from('profiles').update({ name, email, phone, admin_note: str('adminNote', 500) }).eq('id', id)
      if (error) return json({ error: authMessage(error.message) }, 400)
      return json({ ok: true })
    }
    case 'password': {
      if (password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı.' }, 400)
      const { error } = await sb.auth.admin.updateUserById(id, { password })
      if (error) return json({ error: authMessage(error.message) }, 400)
      return json({ ok: true })
    }
    case 'delete': {
      // Profil ve randevular veritabanında "on delete cascade" ile birlikte silinir
      const { error } = await sb.auth.admin.deleteUser(id)
      if (error) return json({ error: authMessage(error.message) }, 400)
      return json({ ok: true })
    }
    default:
      return json({ error: 'Bilinmeyen işlem.' }, 400)
  }
}

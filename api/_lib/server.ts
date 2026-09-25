/**
 * Vercel sunucu fonksiyonları için ortak yardımcılar.
 * "_" ile başlayan klasörler Vercel'de fonksiyon olarak yayınlanmaz, sadece içe aktarılır.
 * NOT: Göreli importlarda ".js" uzantısı zorunlu (Vercel'de Node ESM çalışıyor).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new HttpError(500, 'Sunucu ayarları eksik: Vercel’e SUPABASE_SERVICE_ROLE_KEY ekle.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export interface Caller {
  sb: SupabaseClient
  userId: string
  role: 'student' | 'admin'
}

/** İstekteki oturum anahtarını doğrular; aktif kullanıcı değilse hata fırlatır. */
export async function requireUser(request: Request, opts: { admin?: boolean } = {}): Promise<Caller> {
  const sb = serviceClient()
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) throw new HttpError(401, 'Oturum bulunamadı.')
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) throw new HttpError(401, 'Oturumun sona erdi. Tekrar giriş yap.')
  const { data: prof } = await sb.from('profiles').select('role,status').eq('id', data.user.id).maybeSingle()
  if (!prof || prof.status !== 'active') throw new HttpError(403, 'Hesabın aktif değil.')
  if (opts.admin && prof.role !== 'admin') throw new HttpError(403, 'Bu işlem için yetkin yok.')
  return { sb, userId: data.user.id, role: prof.role }
}

/** Beklenen hataları JSON'a çevirir, beklenmeyenleri loglar. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: e instanceof Error ? e.message : 'Sunucu hatası.' }, 500)
  })
}

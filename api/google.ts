/**
 * POST /api/google  { action: 'status' | 'connect' | 'disconnect' | 'sync', force?: boolean }
 * status/connect/disconnect → sadece yönetici · sync → giriş yapmış herkes (sık çağrı kısıtlı)
 */
import { GOOGLE_SCOPES, getIntegration, googleEnv, redirectUri, revoke, sync } from './_lib/google.js'
import { HttpError, handle, json, requireUser } from './_lib/server.js'

export function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = (await request.json().catch(() => ({}))) as { action?: string; force?: boolean }
    const env = googleEnv()

    if (body.action === 'sync') {
      const { sb, role } = await requireUser(request)
      const result = await sync(sb, !!body.force)
      // Öğrenciye iç hata ayrıntısı gösterme
      return json(role === 'admin' ? result : { connected: result.connected, synced: result.synced })
    }

    const { sb, userId } = await requireUser(request, { admin: true })

    switch (body.action) {
      case 'status': {
        const g = await getIntegration(sb)
        return json({
          configured: env.configured,
          connected: !!g.refresh_token,
          email: g.email,
          lastSyncedAt: g.last_synced_at,
          lastError: g.last_error,
          redirectUri: redirectUri(request),
        })
      }
      case 'connect': {
        if (!env.configured) throw new HttpError(400, 'Önce Vercel’e GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET ekle.')
        const state = crypto.randomUUID() + crypto.randomUUID()
        // Eski (15 dk'dan eski) anahtarları temizle, yenisini kaydet
        await sb.from('oauth_states').delete().lt('created_at', new Date(Date.now() - 15 * 60_000).toISOString())
        const { error } = await sb.from('oauth_states').insert({ state, user_id: userId })
        if (error) throw new HttpError(500, 'Veritabanı güncel değil: supabase/schema.sql dosyasını tekrar çalıştır.')
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
        url.search = new URLSearchParams({
          client_id: env.clientId!,
          redirect_uri: redirectUri(request),
          response_type: 'code',
          scope: GOOGLE_SCOPES.join(' '),
          access_type: 'offline',
          prompt: 'consent', // refresh_token'ın her seferinde gelmesi için
          include_granted_scopes: 'true',
          state,
        }).toString()
        return json({ url: url.toString() })
      }
      case 'disconnect': {
        const g = await getIntegration(sb)
        if (g.refresh_token) await revoke(g.refresh_token)
        await sb.from('google_integration').update({ refresh_token: null, email: null, connected_at: null, last_error: null }).eq('id', 1)
        await sb.rpc('replace_external_busy', { p_rows: [] })
        return json({ ok: true })
      }
      default:
        throw new HttpError(400, 'Bilinmeyen işlem.')
    }
  })
}

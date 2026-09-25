/**
 * GET /api/google-callback — Google izin ekranından dönüş adresi.
 * Google Cloud Console'da "Authorized redirect URIs" alanına birebir bu adres yazılmalı:
 *   https://SITE-ADRESIN/api/google-callback
 */
import { googleEnv, redirectUri, sync } from './_lib/google.js'
import { serviceClient } from './_lib/server.js'

const back = (request: Request, params: Record<string, string>) => {
  const base = (process.env.APP_URL || new URL(request.url).origin).replace(/\/+$/, '')
  return Response.redirect(`${base}/yonetim/musaitlik?${new URLSearchParams(params)}`, 302)
}

function emailFromIdToken(idToken?: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(idToken!.split('.')[1], 'base64url').toString('utf8')) as { email?: string }
    return payload.email ?? null
  } catch {
    return null
  }
}

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams
  if (q.get('error')) return back(request, { google: 'error', msg: q.get('error') === 'access_denied' ? 'İzin verilmedi.' : q.get('error')! })
  const code = q.get('code')
  const state = q.get('state')
  if (!code || !state) return back(request, { google: 'error', msg: 'Eksik bilgi döndü.' })

  try {
    const sb = serviceClient()
    // Tek kullanımlık, 15 dk geçerli anahtar
    const { data: st } = await sb.from('oauth_states').delete().eq('state', state).select('user_id,created_at').maybeSingle()
    if (!st || Date.now() - new Date(st.created_at).getTime() > 15 * 60_000) {
      return back(request, { google: 'error', msg: 'Bağlantı isteğinin süresi doldu, tekrar dene.' })
    }
    const { data: prof } = await sb.from('profiles').select('role,status').eq('id', st.user_id).maybeSingle()
    if (!prof || prof.role !== 'admin' || prof.status !== 'active') return back(request, { google: 'error', msg: 'Yetkisiz.' })

    const { clientId, clientSecret } = googleEnv()
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId ?? '',
        client_secret: clientSecret ?? '',
        redirect_uri: redirectUri(request),
        grant_type: 'authorization_code',
      }),
    })
    const tok = (await res.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; scope?: string; error_description?: string }
    if (!res.ok) return back(request, { google: 'error', msg: tok.error_description ?? 'Google anahtarı alınamadı.' })
    if (!tok.scope?.includes('calendar.events')) {
      return back(request, { google: 'error', msg: 'Takvim izni verilmedi. Bağlanırken takvim kutucuğunu işaretle.' })
    }
    if (!tok.refresh_token) return back(request, { google: 'error', msg: 'Google kalıcı anahtar vermedi, tekrar dene.' })

    await sb
      .from('google_integration')
      .update({
        refresh_token: tok.refresh_token,
        email: emailFromIdToken(tok.id_token),
        connected_at: new Date().toISOString(),
        last_error: null,
        last_synced_at: null,
      })
      .eq('id', 1)
    await sync(sb, true)
    return back(request, { google: 'connected' })
  } catch (e) {
    console.error(e)
    return back(request, { google: 'error', msg: e instanceof Error ? e.message : 'Bilinmeyen hata' })
  }
}

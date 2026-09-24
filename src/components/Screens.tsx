import { Brand, BrandMark } from './Brand'

export function Loader() {
  return (
    <div className="screen-center">
      <div className="loader">
        <BrandMark size={52} />
        <span className="loader-bar" />
      </div>
    </div>
  )
}

/** Ortam değişkenleri girilmemişse gösterilir (ör. Vercel'de VITE_SUPABASE_URL eksik). */
export function SetupScreen() {
  return (
    <div className="screen-center">
      <div className="card glass glow setup">
        <Brand />
        <h2>Kurulum tamamlanmamış</h2>
        <p className="muted">
          Supabase bağlantı bilgileri bulunamadı. Vercel → Project → Settings → Environment Variables bölümüne aşağıdaki iki
          değişkeni ekleyip projeyi yeniden deploy et (yerelde çalışıyorsan <code>.env.local</code> dosyasına yaz).
        </p>
        <pre className="code">VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=…</pre>
      </div>
    </div>
  )
}

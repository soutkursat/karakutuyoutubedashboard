import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Brand } from '../components/Brand'
import { BRAND } from '../lib/ui'
import { formatPhone } from '../lib/validation'

/**
 * Herkese açık yasal sayfalar (giriş gerekmez). Google OAuth "Branding" ekranı bu linkleri ister:
 *   https://dashboard.karakutuyoutube.com/gizlilik
 *   https://dashboard.karakutuyoutube.com/kosullar
 * İletişim bilgilerini değiştirmek için sadece aşağıdaki sabitleri düzenle.
 */
const CONTACT_EMAIL = 'kursadofficial55@gmail.com'
const CONTACT_WHATSAPP = '905377935090'
const SITE = 'https://dashboard.karakutuyoutube.com'
const UPDATED = '2 Ekim 2026'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="legal">
      <header className="legal-top">
        <Link to="/giris" aria-label="Giriş sayfasına dön"><Brand /></Link>
        <nav className="legal-nav">
          <Link to="/gizlilik">Gizlilik</Link>
          <Link to="/kosullar">Kullanım koşulları</Link>
          <Link to="/giris" className="btn btn-ghost btn-sm">Giriş yap</Link>
        </nav>
      </header>
      <article className="card glass legal-card">
        <span className="eyebrow">Son güncelleme: {UPDATED}</span>
        <h1>{title}</h1>
        {children}
        <hr />
        <p className="muted">
          İletişim: <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> · WhatsApp {formatPhone(CONTACT_WHATSAPP)}
        </p>
      </article>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Gizlilik Politikası">
      <p>
        Bu politika, {BRAND} mentörlük randevu panelinin ({SITE}) hangi kişisel verileri topladığını, nasıl kullandığını ve
        nasıl koruduğunu açıklar. Panel, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) çerçevesinde işletilir.
      </p>

      <h2>Topladığımız veriler</h2>
      <ul>
        <li><strong>Hesap bilgileri:</strong> ad soyad, e-posta adresi, WhatsApp numarası ve şifre (şifreler şifrelenmiş olarak saklanır, kimse göremez).</li>
        <li><strong>Randevu bilgileri:</strong> randevu tarihi ve saati, görüşme konusu, eklediğin notlar, randevu durumu.</li>
        <li><strong>Kanal bilgileri (isteğe bağlı):</strong> YouTube kanal linklerin, para kazanma durumu, kanal başlangıç tarihi, yükleme sıklığı, video sayısı, kanal konusu, zorlandığın konular ve rakip kanal linkleri.</li>
        <li><strong>Topluluk bilgisi:</strong> Skool topluluğunda olup olmadığın.</li>
      </ul>

      <h2>Verileri ne için kullanıyoruz</h2>
      <ul>
        <li>Mentörlük randevularını planlamak, onaylamak ve hatırlatmak,</li>
        <li>Görüşmeler için Google Meet linki oluşturmak,</li>
        <li>Mentörün kanalını analiz ederek sana daha iyi geri bildirim verebilmesi.</li>
      </ul>
      <p>Verilerin reklam amacıyla kullanılmaz, satılmaz ve üçüncü kişilerle paylaşılmaz.</p>

      <h2>Kimler görebilir</h2>
      <p>
        Bilgilerini yalnızca sen ve mentörün (panel yöneticisi) görebilir. Diğer öğrenciler senin bilgilerini, kanallarını veya
        randevu ayrıntılarını göremez; randevu takviminde yalnızca saatin dolu olduğunu görürler.
      </p>

      <h2>Google kullanıcı verileri</h2>
      <p>
        Panel, yalnızca <strong>mentörün kendi Google hesabıyla</strong> Google Takvim’e bağlanır. Bu bağlantı
        (<code>calendar.events</code> izni) sadece şu amaçla kullanılır: randevuları mentörün Google Takvimine etkinlik olarak
        eklemek, bu etkinliklere otomatik Google Meet linki oluşturmak, randevu onaylandığında öğrenciye takvim daveti
        göndermek ve iptal edilen randevunun etkinliğini silmek. Mentörün takvimindeki diğer etkinlikler okunmaz, saklanmaz ve
        başka bir amaçla kullanılmaz. Öğrencilerden Google hesabı bağlamaları istenmez.
      </p>
      <p>
        {BRAND}’nin Google API’lerinden aldığı bilgileri kullanması ve aktarması, Sınırlı Kullanım (Limited Use) koşulları dahil
        olmak üzere <a className="link" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer">Google API Hizmetleri Kullanıcı Verileri Politikası</a>’na
        uygundur. <em>({BRAND}’s use and transfer of information received from Google APIs will adhere to the Google API Services
        User Data Policy, including the Limited Use requirements.)</em>
      </p>
      <p>Google bağlantısı mentör tarafından istendiği an kaldırılabilir; kaldırıldığında Google erişim anahtarı silinir.</p>

      <h2>Verilerin saklanması ve güvenliği</h2>
      <p>
        Veriler, güvenli ve şifreli bağlantı (HTTPS) üzerinden; veritabanı hizmeti olarak Supabase, barındırma hizmeti olarak
        Vercel altyapısında saklanır. Erişim, satır düzeyinde güvenlik kurallarıyla sınırlandırılmıştır.
      </p>

      <h2>Haklarını kullanma</h2>
      <p>
        KVKK kapsamında verilerine erişme, düzeltme ve silinmesini isteme hakkına sahipsin. Profil bilgilerini ve kanallarını
        panelden kendin düzenleyebilir veya silebilirsin. Hesabının ve tüm verilerinin silinmesi için aşağıdaki iletişim
        kanallarından bize yazman yeterli; talebin en geç 30 gün içinde yerine getirilir.
      </p>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Kullanım Koşulları">
      <p>
        {BRAND} mentörlük randevu panelini ({SITE}) kullanarak aşağıdaki koşulları kabul etmiş olursun.
      </p>
      <h2>Hizmet</h2>
      <p>
        Panel, {BRAND} mentörlük programındaki öğrencilerin mentörün müsait saatlerinden randevu almasını, randevularını takip
        etmesini ve kanal bilgilerini mentörle paylaşmasını sağlar.
      </p>
      <h2>Hesap</h2>
      <ul>
        <li>Kayıt olurken doğru ve güncel bilgi vermelisin.</li>
        <li>Şifrenin güvenliğinden sen sorumlusun; hesabını başkasıyla paylaşmamalısın.</li>
        <li>Kurallara aykırı kullanımda hesap askıya alınabilir veya kapatılabilir.</li>
      </ul>
      <h2>Randevular</h2>
      <ul>
        <li>Randevu hakları ve sıklığı panelde belirtilen kurallara tabidir (ör. yeni üyeler için haftada 1, sonrasında 2 haftada 1).</li>
        <li>Randevunu, panelde belirtilen süreden daha geç olmamak kaydıyla iptal edebilirsin.</li>
        <li>Mentör, zorunlu durumlarda randevuyu iptal edebilir veya yeniden planlayabilir; bu durumda bilgilendirilirsin.</li>
        <li>Görüşmeler Google Meet üzerinden yapılır.</li>
      </ul>
      <h2>İçerik ve sorumluluk</h2>
      <p>
        Mentörlük görüşmelerinde verilen tavsiyeler bilgilendirme amaçlıdır; kanalının sonuçlarına ilişkin herhangi bir garanti
        verilmez. Panelin kesintisiz ve hatasız çalışması için makul özen gösterilir, ancak teknik aksaklıklardan doğan dolaylı
        zararlardan sorumluluk kabul edilmez.
      </p>
      <h2>Gizlilik</h2>
      <p>
        Kişisel verilerin <Link className="link" to="/gizlilik">Gizlilik Politikası</Link>’na uygun olarak işlenir.
      </p>
      <h2>Değişiklikler</h2>
      <p>Bu koşullar gerektiğinde güncellenebilir; güncel hali her zaman bu sayfada yayınlanır.</p>
    </LegalLayout>
  )
}

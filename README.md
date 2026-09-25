# Kara Kutu · Mentörlük Paneli

Kara Kutu YouTube Akademi öğrencileri için randevu sistemi.
Öğrenci giriş yapar → müsait saati seçer → randevu oluşur → açılan pop-up'tan **tek tuşla WhatsApp'a**
(+90 537 793 50 90) hazır mesaj olarak bildirir. Sen de randevuları hem WhatsApp'ta hem de yönetim panelinde görürsün.

## Kurulum (Supabase + Vercel)

### 1) Supabase
1. [supabase.com](https://supabase.com) → **New project** (bölge: *Central EU (Frankfurt)*).
2. **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştır → **Run**.
3. **Authentication → Sign In / Providers → Email**: başlangıç için **"Confirm email" kapalı** olsun
   (Supabase'in ücretsiz e-posta gönderimi saatte birkaç e-postayla sınırlı; açık kalırsa öğrenciler onay e-postası bekler).
4. **Authentication → URL Configuration → Site URL**: Vercel adresin (ör. `https://karakutuyoutubedashboard.vercel.app`).
5. **Yönetici hesabı:** Authentication → Users → **Add user → Create new user** (kendi e-postan + güçlü şifre,
   *Auto Confirm* işaretli). Sonra `supabase/admin.sql` içindeki e-postayı kendininkiyle değiştirip SQL Editor'de çalıştır.
   Artık `kursatyoutube` kullanıcı adı veya e-postanla giriş yapabilirsin.
6. **Project Settings → API** ekranından şu üç değeri al: *Project URL*, *anon / publishable key*, *service_role / secret key*.

### 2) Vercel
Import ekranında: Preset **Vite**, Root **./**, Build ayarları varsayılan. **Environment Variables**:

| Ad | Değer | Not |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key | tarayıcıda görünür, güvenli |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role / secret key | **GİZLİ** — sadece sunucu fonksiyonu kullanır, kimseyle paylaşma |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth | **GİZLİ** — bkz. adım 3 |

Deploy'dan sonra değişken eklersen/değiştirirsen **Redeploy** gerekir.

### 3) Google Takvim + otomatik Meet (isteğe bağlı ama önerilir)
Bağlanınca: Google Takviminde dolu olduğun saatler öğrencilere otomatik kapanır, her randevu takvimine
**otomatik Google Meet linkiyle** eklenir, onayladığında öğrenciye Google davet e-postası gider, iptalde etkinlik silinir.

1. [console.cloud.google.com](https://console.cloud.google.com) → yeni proje oluştur (ör. "Kara Kutu Panel").
2. **APIs & Services → Library** → **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen** (Google Auth Platform):
   - User type: **External** · Uygulama adı: *Kara Kutu Panel* · destek e-postası: kendi Gmail'in
   - **Audience → Publishing status → "Publish app" (In production)**. ⚠️ "Testing" modunda kalırsa
     Google bağlantısı **7 günde bir kopar**.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - **Authorized redirect URIs:** `https://SITE-ADRESIN/api/google-callback`
     (tam adres Müsaitlik sayfasındaki Google kartında yazar)
5. Çıkan **Client ID** ve **Client secret**'ı Vercel'e ekle: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` → **Redeploy**.
6. Supabase SQL Editor'de `supabase/schema.sql`'i **tekrar** çalıştır (yeni tablolar eklenir, veriler silinmez).
7. Panel → **Müsaitlik → Google Takvim → "Google hesabımı bağla"**. Google "doğrulanmamış uygulama" uyarısı
   gösterirse **Gelişmiş → Kara Kutu Panel'e git** de (kendi uygulaman olduğu için güvenli), takvim iznini işaretle.

### 4) Yerelde çalıştırma
```bash
cp .env.example .env.local   # değerleri doldur
npm install
npm run dev                  # http://localhost:5173
```
Öğrenci ekleme/silme/şifre sıfırlama `api/admin.ts` sunucu fonksiyonunu kullanır; bu yalnızca Vercel'de
(veya `npx vercel dev` ile) çalışır. Diğer her şey `npm run dev` ile çalışır.

## Özellikler (v0.1)

**Öğrenci paneli**
- Kayıt / giriş (e-posta + şifre), profil ve şifre değiştirme
- Gün şeridi + saat ızgarası ile randevu alma (Türkiye saati)
- Görüşme konusu + not
- Randevu sonrası pop-up → **WhatsApp'tan bildir** (tarih, saat, konu, not, iletişim bilgisi, randevu no)
- Randevularım: yaklaşan / geçmiş / iptal, Meet'e katıl, iptal (+ iptali WhatsApp'tan bildirme)

**Yönetim paneli** (sadece `kursatyoutube`)
- Genel bakış: bugün, onay bekleyen, 7 gün, öğrenci sayısı
- Randevular: filtre + arama, onayla, Meet linki ekle, tamamlandı, iptal/geri al, öğrenciye WhatsApp'tan yaz
- Müsaitlik: haftalık saat aralıkları, görüşme süresi, mola, min. bildirim süresi, ileri tarih limiti, kapalı günler
- Öğrenciler: ekle, düzenle, şifre sıfırla, özel not, askıya al, sil
- Ayarlar: WhatsApp numarası, varsayılan Meet linki, otomatik onay, kayıt açık/kapalı, davet kodu, konu listesi, JSON dışa aktarma
- Yeni randevular panele anında düşer (Supabase Realtime)

**Hata önleme**
- Aynı saate iki randevu alınamaz (kayıt anında tekrar kontrol edilir)
- Geçmiş saatler ve "en az X saat önceden" kuralı
- Öğrenci başına aktif randevu limiti (takvimi tek kişi kapatamaz)
- Son X saatte öğrenci iptal edemez
- Telefon numarası otomatik WhatsApp biçimine çevrilir (0537… → 90537…)
- Aynı e-posta / telefonla ikinci hesap açılamaz
- Askıya alınan öğrencinin gelecek randevuları otomatik iptal olur
- Pop-up engelleyici WhatsApp'ı engellerse aynı sekmede açılır

## Proje yapısı

```
src/
  lib/db.ts          ← TÜM veri işlemleri (Supabase çağrıları + önbellek)
  lib/supabase.ts    ← Supabase istemcisi
  lib/slots.ts       ← müsaitlikten slot üretimi, çakışma kontrolü
  lib/time.ts        ← İstanbul saat dilimi yardımcıları
  lib/whatsapp.ts    ← WhatsApp mesaj şablonları
  components/        ← AppShell, Modal, Toast, BookingSuccess (pop-up), ikonlar…
  pages/student/     ← öğrenci ekranları
  pages/admin/       ← yönetim ekranları
  styles.css         ← tasarım sistemi (renkler, cam kartlar, grid dokusu)
api/admin.ts         ← Vercel sunucu fonksiyonu (öğrenci ekle/sil/şifre sıfırla)
api/google.ts        ← Google Takvim: bağlan / durum / senkron
api/google-callback.ts ← Google izin ekranından dönüş
api/_lib/            ← sunucu ortak kodu (Google senkron mantığı burada)
supabase/schema.sql  ← veritabanı: tablolar, güvenlik kuralları, randevu fonksiyonları
supabase/admin.sql   ← yönetici hesabını tanımlama
AGENTS.md            ← Codex'in uyacağı proje kuralları
```

## Güvenlik nasıl sağlanıyor?

- Şifreler Supabase Auth'ta tutulur; kodda şifre yok.
- Her tabloda **Row Level Security** açık: öğrenci sadece kendi profilini ve randevularını görür,
  diğer öğrencilerin sadece *dolu saatlerini* görür (kim olduğu gizli).
- Randevu oluşturma/iptal sunucudaki fonksiyonlarla yapılır; saat hizası, müsaitlik, kapalı gün, minimum süre,
  aktif randevu limiti ve iptal süresi **sunucuda** tekrar kontrol edilir.
- Çift randevu veritabanı seviyesinde imkânsız (`exclusion constraint`), aynı anda iki kişi tıklasa bile.
- Davet kodu gizli tabloda; kayıt kuralları veritabanı tetikleyicisinde de uygulanır.
- `service_role` anahtarı sadece `api/admin.ts` içinde, her istekte çağıranın aktif yönetici olduğu doğrulanır.

## Yol haritası

1. ~~**Aşama 2 — Gerçek sunucu (Supabase + Vercel)**~~ ✅
2. ~~**Aşama 3 — Google Takvim + Meet**~~ ✅
3. **Aşama 4 — Otomatik hatırlatmalar:** 24 saat / 1 saat önce e-posta (Resend) veya WhatsApp Business API.

# Kara Kutu · Mentörlük Paneli

Kara Kutu YouTube Akademi öğrencileri için randevu sistemi.
Öğrenci giriş yapar → müsait saati seçer → randevu oluşur → açılan pop-up'tan **tek tuşla WhatsApp'a**
(+90 537 793 50 90) hazır mesaj olarak bildirir. Sen de randevuları hem WhatsApp'ta hem de yönetim panelinde görürsün.

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini aç.

| Hesap | Giriş |
|---|---|
| Yönetici | kullanıcı adı `kursatyoutube` · şifre `123456` |
| Öğrenci | "Kayıt ol" sekmesinden hesap aç |

> Yönetici şifresini ilk girişten sonra **Hesabım** sayfasından değiştir.

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
- Ayarlar: WhatsApp numarası, varsayılan Meet linki, otomatik onay, kayıt açık/kapalı, davet kodu, konu listesi, JSON yedek

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
  lib/db.ts          ← TÜM veri işlemleri ve iş kuralları (sunucuya geçerken sadece burası değişir)
  lib/slots.ts       ← müsaitlikten slot üretimi, çakışma kontrolü
  lib/time.ts        ← İstanbul saat dilimi yardımcıları
  lib/whatsapp.ts    ← WhatsApp mesaj şablonları
  components/        ← AppShell, Modal, Toast, BookingSuccess (pop-up), ikonlar…
  pages/student/     ← öğrenci ekranları
  pages/admin/       ← yönetim ekranları
  styles.css         ← tasarım sistemi (renkler, cam kartlar, grid dokusu)
AGENTS.md            ← Codex'in uyacağı proje kuralları
```

## ⚠️ Bu sürüm bir taslaktır

Veriler şu an **tarayıcının kendi hafızasında (localStorage)** tutuluyor. Yani:
- Öğrencinin telefonunda aldığı randevu senin bilgisayarındaki panelde **görünmez** (farklı cihazlar veri paylaşmaz).
- Yönetici şifresi kodun içinde duruyor.

Tasarımı ve akışı denemek için idealdir; gerçek öğrencilere açmadan önce **Aşama 2** gerekli.

## Yol haritası

1. **Aşama 2 — Gerçek sunucu (Supabase):** veritabanı, gerçek oturum yönetimi, şifreler sunucuda.
   `src/lib/db.ts` fonksiyonları Supabase çağrılarıyla değiştirilecek. Çift randevuya karşı veritabanında
   benzersizlik kuralı (unique constraint) eklenecek. Vercel'e yayın.
2. **Aşama 3 — Google Takvim + Meet:** yöneticinin Google hesabı bir kez bağlanır; her randevuda otomatik
   takvim etkinliği + Meet linki oluşur, öğrenciye davet e-postası gider. Google takviminde dolu olduğun
   saatler panelde otomatik kapanır.
3. **Aşama 4 — Otomatik hatırlatmalar:** 24 saat / 1 saat önce e-posta (Resend) veya WhatsApp Business API.

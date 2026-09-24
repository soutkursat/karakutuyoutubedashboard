# AGENTS.md — Kara Kutu Dashboard

Bu dosya Codex / Claude gibi kod asistanları içindir. Her görevde önce bunu oku.

## Proje
Kara Kutu YouTube Akademi mentörlük randevu paneli. Öğrenciler giriş yapıp mentörün müsait
saatlerinden randevu alır, ardından tek tuşla WhatsApp'tan bildirir. Yönetici (kursatyoutube)
randevuları, müsaitliği, öğrencileri ve ayarları yönetir.

## Teknoloji
- Vite + React 19 + TypeScript (strict) + react-router-dom 7
- Stil: tek dosya `src/styles.css` (CSS değişkenleri, Tailwind YOK)
- Ek kütüphane eklemeden önce gerçekten gerekli mi düşün.

## Mimari kuralları
- **Tüm veri erişimi `src/lib/db.ts` üzerinden.** Sayfalar localStorage'a doğrudan dokunmaz.
  Sunucuya (Supabase) geçerken sadece bu dosya değişecek.
- İş kuralları ve doğrulama `db.ts` içinde yapılır (UI'daki kontroller sadece kolaylık içindir).
  Hata fırlatırken `AppError` kullan, mesaj Türkçe ve kullanıcıya gösterilebilir olsun.
- Saatler her zaman **Europe/Istanbul**. Tarih hesabı için `src/lib/time.ts` kullan, `new Date().getHours()` gibi
  yerel saat fonksiyonları KULLANMA.
- Randevu slotları `src/lib/slots.ts` içinde üretilir; çakışma kontrolü de oradadır.
- WhatsApp mesaj şablonları `src/lib/whatsapp.ts` içinde.
- Arayüz metinleri Türkçe.

## Tasarım dili
Siyah zemin, kırmızı→turuncu gradyan vurgu, ince grid dokusu, cam (glass) kartlar.
Yeni ekran eklerken mevcut sınıfları kullan: `card glass`, `glow`, `btn btn-primary|btn-ghost|btn-wa|btn-text`,
`field`, `input`, `chip`, `badge`, `notice`, `seg`, `PageHeader`, `Empty`, `Modal`, `useToast`.
Mobil (390px) görünümü her değişiklikte kontrol et.

## Komutlar
- `npm run dev` — geliştirme sunucusu
- `npm run build` — tip kontrolü + üretim derlemesi (commit öncesi mutlaka çalıştır, hatasız geçmeli)

## Güvenlik notu
Şu anki sürüm tarayıcı içi bir taslaktır; yönetici şifresi kodda tohum olarak durur ve veriler
tarayıcıda saklanır. Gerçek kullanıma geçmeden önce README'deki "Aşama 2" yapılmalıdır.

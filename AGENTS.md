# AGENTS.md — Kara Kutu Dashboard

Bu dosya Codex / Claude gibi kod asistanları içindir. Her görevde önce bunu oku.

## Proje
Kara Kutu YouTube Akademi mentörlük randevu paneli. Öğrenciler giriş yapıp mentörün müsait
saatlerinden randevu alır, ardından tek tuşla WhatsApp'tan bildirir. Yönetici (kursatyoutube)
randevuları, müsaitliği, öğrencileri ve ayarları yönetir.

## Teknoloji
- Vite + React 19 + TypeScript (strict) + react-router-dom 7
- Supabase (Postgres + Auth + Realtime) · Vercel (hosting + `api/` sunucu fonksiyonları)
- Stil: tek dosya `src/styles.css` (CSS değişkenleri, Tailwind YOK)
- Ek kütüphane eklemeden önce gerçekten gerekli mi düşün.

## Mimari kuralları
- **Tüm veri erişimi `src/lib/db.ts` üzerinden.** Sayfalar `supabase` istemcisini doğrudan kullanmaz.
  Okumalar senkron (bellekteki önbellekten), yazmalar `async`tır ve sonunda `refresh()` çağırır.
  Sayfalarda her yazma çağrısı `await` edilmeli, hata `toast(errMsg(e), 'error')` ile gösterilmeli,
  işlem sürerken buton `disabled` olmalı (çift tıklama).
- **Asıl güvenlik sunucuda:** `supabase/schema.sql` (RLS politikaları + `security definer` fonksiyonlar).
  Yeni bir yazma kuralı eklerken önce SQL'e ekle; istemcideki kontrol sadece hızlı geri bildirim içindir.
  Şemayı değiştirirken dosya tekrar çalıştırılabilir kalmalı (`if not exists`, `create or replace`).
  SQL fonksiyonlarındaki `raise exception` mesajları Türkçe yazılır, doğrudan kullanıcıya gösterilir.
- `service_role` anahtarı SADECE `api/` altındaki Vercel fonksiyonlarında kullanılır, asla `VITE_` ile başlamaz.
- Hata fırlatırken `AppError` kullan, mesaj Türkçe ve kullanıcıya gösterilebilir olsun.
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

## Ortam değişkenleri
`.env.example` dosyasına bak. Gerçek değerler `.env.local` içinde durur ve asla commit edilmez.

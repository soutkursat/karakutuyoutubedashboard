import type { Appointment, User } from './types'
import { formatDateLong, formatTime } from './time'
import { formatPhone } from './validation'

const STATUS_TR = { pending: 'Onay bekliyor', confirmed: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal edildi' }

export function waLink(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
}

/** Öğrenci → Mentör: yeni randevu bildirimi */
export function newBookingMessage(a: Appointment, student: User) {
  return [
    '*Kara Kutu YouTube Akademi* 📌',
    'Merhaba, sistem üzerinden yeni bir mentörlük randevusu oluşturdum.',
    '',
    `👤 *Ad Soyad:* ${student.name}`,
    `📱 *Telefon:* ${formatPhone(student.phone)}`,
    `📧 *E-posta:* ${student.email}`,
    '',
    `📅 *Tarih:* ${formatDateLong(a.start)}`,
    `⏰ *Saat:* ${formatTime(a.start)} - ${formatTime(a.end)} (TR saati)`,
    `🎯 *Konu:* ${a.topic}`,
    a.note ? `📝 *Not:* ${a.note}` : null,
    '',
    `🔖 *Randevu No:* ${a.code}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/** Öğrenci → Mentör: iptal bildirimi */
export function cancelMessage(a: Appointment, student: User) {
  return [
    '*Kara Kutu YouTube Akademi* ❌',
    'Merhaba, aşağıdaki randevumu iptal ettim.',
    '',
    `👤 ${student.name}`,
    `📅 ${formatDateLong(a.start)} · ${formatTime(a.start)}`,
    `🔖 ${a.code}`,
    a.cancelReason ? `📝 Sebep: ${a.cancelReason}` : null,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

/** Mentör → Öğrenci: durum / Meet linki bilgisi */
export function toStudentMessage(a: Appointment, student: User) {
  return [
    `Merhaba ${student.name.split(' ')[0]} 👋`,
    'Kara Kutu YouTube Akademi mentörlük randevun hakkında:',
    '',
    `📅 ${formatDateLong(a.start)}`,
    `⏰ ${formatTime(a.start)} - ${formatTime(a.end)} (TR saati)`,
    `📌 Durum: ${STATUS_TR[a.status]}`,
    a.meetLink && a.status === 'confirmed' ? `🎥 Google Meet: ${a.meetLink}` : null,
    '',
    `🔖 ${a.code}`,
  ]
    .filter((l) => l !== null)
    .join('\n')
}

export function openWhatsapp(url: string) {
  // Not: 'noopener' parametresi verilirse window.open her zaman null döner ve
  // engellendi mi anlaşılamaz. Bu yüzden yeni sekmeyi açıp bağlantıyı elle koparıyoruz.
  const w = window.open(url, '_blank')
  if (w) {
    w.opener = null
  } else {
    // Pop-up engelleyiciye takıldıysa aynı sekmede aç
    window.location.href = url
  }
}

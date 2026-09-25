import type { Appointment, User } from './types'
import { formatDateLong, formatTime } from './time'
import { formatPhone } from './validation'

// NOT: Mesajlarda emoji KULLANMIYORUZ. WhatsApp Masaüstü/Web, wa.me linkiyle gelen
// bazı emojileri "�" olarak gösteriyor. Sadece düz metin + WhatsApp biçimi (*kalın*).

const STATUS_TR = { pending: 'Onay bekliyor', confirmed: 'Onaylandı', completed: 'Tamamlandı', cancelled: 'İptal edildi' }

export function waLink(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
}

const lines = (...l: (string | null | false | undefined)[]) => l.filter((x) => x !== null && x !== false && x !== undefined).join('\n')
const phoneOf = (u: User) => (u.phone ? formatPhone(u.phone) : 'Belirtilmemiş')

/** Öğrenci → Mentör: yeni randevu bildirimi */
export function newBookingMessage(a: Appointment, student: User) {
  return lines(
    '*KARA KUTU YOUTUBE AKADEMİSİ*',
    '*Yeni Mentörlük Randevusu*',
    '',
    'Merhaba, sistem üzerinden yeni bir mentörlük randevusu oluşturdum.',
    '',
    `*Ad Soyad:* ${student.name}`,
    `*Telefon:* ${phoneOf(student)}`,
    `*E-posta:* ${student.email}`,
    '',
    `*Tarih:* ${formatDateLong(a.start)}`,
    `*Saat:* ${formatTime(a.start)} - ${formatTime(a.end)} (TR saati)`,
    `*Konu:* ${a.topic}`,
    a.note ? `*Not:* ${a.note}` : null,
    '',
    `*Randevu No:* ${a.code}`,
  )
}

/** Öğrenci → Mentör: iptal bildirimi */
export function cancelMessage(a: Appointment, student: User) {
  return lines(
    '*KARA KUTU YOUTUBE AKADEMİSİ*',
    '*Randevu İptali*',
    '',
    'Merhaba, aşağıdaki randevumu iptal ettim.',
    '',
    `*Ad Soyad:* ${student.name}`,
    `*Tarih:* ${formatDateLong(a.start)} - ${formatTime(a.start)}`,
    `*Randevu No:* ${a.code}`,
    a.cancelReason ? `*Sebep:* ${a.cancelReason}` : null,
  )
}

/** Mentör → Öğrenci: durum / Meet linki bilgisi */
export function toStudentMessage(a: Appointment, student: User) {
  return lines(
    `Merhaba ${student.name.split(' ')[0]},`,
    'Kara Kutu YouTube Akademisi mentörlük randevun hakkında bilgi:',
    '',
    `*Tarih:* ${formatDateLong(a.start)}`,
    `*Saat:* ${formatTime(a.start)} - ${formatTime(a.end)} (TR saati)`,
    `*Durum:* ${STATUS_TR[a.status]}`,
    a.meetLink && a.status === 'confirmed' ? `*Google Meet:* ${a.meetLink}` : null,
    '',
    `*Randevu No:* ${a.code}`,
  )
}

/** Öğrenci → Mentör: bekleme sürecinde soru sormak için hazır başlangıç */
export function questionMessage(student: User) {
  return lines('*KARA KUTU YOUTUBE AKADEMİSİ*', '', `Merhaba, ben ${student.name}. Bir sorum var:`, '')
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

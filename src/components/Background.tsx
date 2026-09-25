/**
 * Sayfa arka planı (tamamen dekoratif, tıklanamaz, ekran okuyucudan gizli).
 * Tüm renkler tema değişkenlerinden gelir → tema değişince logo ve ışıklar da değişir.
 * Okunurluk için: çok düşük opaklık + içerik kartları cam bulanıklığıyla bunun önünde durur.
 */
export function Background() {
  return (
    <div className="bg-fx" aria-hidden>
      <div className="bg-side bg-side-l" />
      <div className="bg-side bg-side-r" />
      <div className="bg-edge bg-edge-l" />
      <div className="bg-edge bg-edge-r" />
      <div className="bg-logo">
        <svg viewBox="0 0 240 170" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="yt-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="yt-s1" />
              <stop offset="1" className="yt-s2" />
            </linearGradient>
            <linearGradient id="yt-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className="yt-s3" />
              <stop offset="0.5" className="yt-s4" />
              <stop offset="1" className="yt-s5" />
            </linearGradient>
            <filter id="yt-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="44" />
            </filter>
          </defs>
          {/* yumuşak hale */}
          <rect className="yt-halo" x="14" y="14" width="212" height="142" rx="44" filter="url(#yt-blur)" />
          {/* gövde */}
          <rect x="6" y="6" width="228" height="158" rx="46" fill="url(#yt-fill)" stroke="url(#yt-stroke)" strokeWidth="1.5" />
          {/* oynat üçgeni */}
          <path className="yt-play" d="M98 52.5c0-3.2 3.5-5.2 6.3-3.6l52.4 30.3c2.8 1.6 2.8 5.6 0 7.2l-52.4 30.3c-2.8 1.6-6.3-.4-6.3-3.6z" />
        </svg>
      </div>
    </div>
  )
}

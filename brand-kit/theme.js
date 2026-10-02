/* Kara Kutu Brand Kit · theme.js — tiny, dependency-free theme switcher.
 * Same storage key as the Dashboard ('kk.theme'). Note: localStorage is per-origin,
 * so each subdomain remembers its own choice (see DESIGN.md › Themes).
 *
 * 1) Put this in <head> BEFORE the stylesheet loads, to avoid a colour flash:
 *    <script>try{var t=localStorage.getItem('kk.theme');if(t==='blue'||t==='mono')document.documentElement.dataset.theme=t}catch(e){}</script>
 * 2) Load this file, then call KKTheme.set('red' | 'blue' | 'mono').
 *    Any element with [data-set-theme="blue"] becomes a theme button automatically. */
(function () {
  var KEY = 'kk.theme'
  var THEMES = ['red', 'blue', 'mono']
  function get() {
    try { var t = localStorage.getItem(KEY); return THEMES.indexOf(t) > 0 ? t : 'red' } catch (e) { return 'red' }
  }
  function apply(t) {
    if (t === 'red') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = t
    document.querySelectorAll('[data-set-theme]').forEach(function (el) {
      el.setAttribute('aria-pressed', String(el.getAttribute('data-set-theme') === t))
    })
  }
  function set(t) {
    if (THEMES.indexOf(t) < 0) return
    try { localStorage.setItem(KEY, t) } catch (e) { /* private mode: apply for this visit only */ }
    apply(t)
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-set-theme]')
    if (el) set(el.getAttribute('data-set-theme'))
  })
  document.addEventListener('DOMContentLoaded', function () { apply(get()) })
  window.KKTheme = { get: get, set: set, THEMES: THEMES }
})()

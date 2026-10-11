// 首屏前定下深浅色，避免闪一下白。偏好：'light' | 'dark' | 'system'（默认跟随系统）
(function () {
  var pref = 'system';
  try { pref = JSON.parse(localStorage.getItem('shunshou:theme') || '"system"'); } catch (e) {}
  var dark = pref === 'dark' || (pref !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();

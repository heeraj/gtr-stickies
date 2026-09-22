const btn = document.getElementById('quit');
if (btn) {
  btn.addEventListener('click', () => {
    if (window.petal && window.petal.quitApp) window.petal.quitApp();
  });
}

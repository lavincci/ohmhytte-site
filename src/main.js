// Starts the hero film once the page is up; the still underneath stays for reduced motion and data saver.
const film = document.querySelector('.hero__film');
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.connection?.saveData;

if (film && !calm) {
  const portrait = matchMedia('(orientation: portrait)').matches;
  film.src = portrait ? '/assets/hero-portrait.mp4' : '/assets/hero.mp4';
  film.addEventListener('playing', () => film.classList.add('is-on'), { once: true });
  film.play().catch(() => {});
}

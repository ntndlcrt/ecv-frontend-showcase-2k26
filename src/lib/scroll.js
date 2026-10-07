/**
 * Verrou de scroll
 * ----------------
 * `stopScroll()` / `startScroll()` utilisables de n'importe où, même avant que
 * Lenis soit monté (les layout effects des enfants passent avant le useEffect
 * de <SmoothScroll>) : l'état est mémorisé et appliqué à l'instance dès qu'elle
 * s'enregistre via `setLenis`.
 */
let instance = null;
let stopped = false;

export function stopScroll() {
	stopped = true;
	instance?.stop();
}

export function startScroll() {
	stopped = false;
	instance?.start();
}

// réservé à <SmoothScroll> : enregistre (ou retire, avec null) l'instance Lenis
export function setLenis(lenis) {
	instance = lenis;
	if (lenis && stopped) lenis.stop();
}

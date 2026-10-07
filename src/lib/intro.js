/**
 * Signal « intro terminée »
 * -------------------------
 * Relie l'intro d'une page au chrome du site (la nav attend que les images
 * soient en place pour apparaître). Une page avec intro appelle `endIntro()` ;
 * la nav s'abonne avec `onIntroEnd()`. Une fois émis, le signal reste acquis :
 * un abonné tardif est appelé tout de suite.
 *
 * Les routes listées dans INTRO_ROUTES ont une intro → la nav les attend.
 */
export const INTRO_ROUTES = ['/'];

let ended = false;
const listeners = new Set();

// Abonnés appelés en microtâche, HORS de tout contexte GSAP : `endIntro()` part
// d'un callback GSAP de la page (onComplete, delayedCall), qui tourne dans le
// contexte de la page. Un contextSafe (la nav) appelé là s'y rattache → quand la
// page est démontée, son revert annulait aussi l'apparition de la nav.
export function endIntro() {
	if (ended) return;
	ended = true;
	const fns = [...listeners];
	listeners.clear();
	queueMicrotask(() => {
		for (const fn of fns) fn();
	});
}

export function onIntroEnd(fn) {
	if (ended) {
		fn();
		return () => {};
	}
	listeners.add(fn);
	return () => listeners.delete(fn);
}

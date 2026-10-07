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

export function endIntro() {
	if (ended) return;
	ended = true;
	for (const fn of listeners) fn();
	listeners.clear();
}

export function onIntroEnd(fn) {
	if (ended) {
		fn();
		return () => {};
	}
	listeners.add(fn);
	return () => listeners.delete(fn);
}

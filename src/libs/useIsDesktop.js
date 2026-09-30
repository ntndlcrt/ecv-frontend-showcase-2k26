'use client';

import { useSyncExternalStore } from 'react';

/**
 * Desktop = écran large ET souris. Une tablette tactile (même en paysage)
 * reçoit donc la version mobile, pensée pour le doigt.
 * ⚠️ Garder synchro avec `@custom-variant desktop` dans globals.css.
 */
export const DESKTOP_QUERY = '(min-width: 1001px) and (pointer: fine)';

const subscribe = (onChange) => {
	const mq = window.matchMedia(DESKTOP_QUERY);
	mq.addEventListener('change', onChange);
	return () => mq.removeEventListener('change', onChange);
};

// Serveur (et hydratation) = mobile par défaut ; le client corrige juste après.
export function useIsDesktop() {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia(DESKTOP_QUERY).matches,
		() => false
	);
}

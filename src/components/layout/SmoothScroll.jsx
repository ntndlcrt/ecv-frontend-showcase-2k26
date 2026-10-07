'use client';

import { useEffect } from 'react';

import Lenis from 'lenis';

import { gsap, ScrollTrigger } from '@/lib/gsap';
import { setLenis } from '@/lib/scroll';

/**
 * SmoothScroll
 * ------------
 * Monte Lenis UNE fois, haut dans l'arbre, et le câble sur le ticker GSAP
 * (donc ScrollTrigger + le shader WebGL tournent tous sur la même horloge).
 *
 *   <SmoothScroll>
 *     <main>…</main>
 *   </SmoothScroll>
 *
 * Verrou de scroll (`stopScroll` / `startScroll`) : voir src/lib/scroll.js.
 */
export default function SmoothScroll({ children, options }) {
	useEffect(() => {
		const lenis = new Lenis(options);
		setLenis(lenis);

		lenis.on('scroll', ScrollTrigger.update);

		// Lenis ne remesure la page que si <html> change de taille — or il est `h-full`,
		// donc jamais. Un pin ajouté après coup (Spotlight desktop chargé à la volée)
		// laissait la limite de scroll à 0. On recale à chaque refresh ScrollTrigger.
		const resize = () => lenis.resize();
		ScrollTrigger.addEventListener('refresh', resize);

		const raf = (time) => lenis.raf(time * 1000);
		gsap.ticker.add(raf);
		gsap.ticker.lagSmoothing(0);

		return () => {
			lenis.off('scroll', ScrollTrigger.update);
			ScrollTrigger.removeEventListener('refresh', resize);
			gsap.ticker.remove(raf);
			lenis.destroy();
			setLenis(null);
		};
	}, [options]);

	return children;
}

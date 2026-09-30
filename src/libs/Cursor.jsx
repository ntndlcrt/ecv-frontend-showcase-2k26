'use client';

import { useEffect } from 'react';

import MouseFollower from 'mouse-follower';

import { gsap } from '@/libs/gsap';

/**
 * Cursor
 * ------
 * Monte le mouse-follower de Cuberto UNE fois, haut dans l'arbre. Il tourne
 * sur le ticker GSAP du projet (même horloge que Lenis + ScrollTrigger).
 *
 *   <Cursor />                       // options par défaut
 *   <Cursor options={{ skewing: 1 }} />
 *
 * États via data-attributes, sur n'importe quel élément :
 *   data-cursor="-inverse"           // classe d'état
 *   data-cursor-text="Voir"          // texte dans la bulle
 *   data-cursor-img="/img1.jpg"      // média dans la bulle
 *   data-cursor-stick                // aimanté au centre de l'élément
 *   data-cursor-icon="arrow"         // icône du sprite public/cursor-sprite.svg
 *
 * Styles : src/app/cursor.scss (importé dans le layout).
 * Désactivé sur les écrans tactiles (pas de pointeur fin) : rien n'est monté.
 * `getCursor()` donne l'instance pour un pilotage impératif (cursor.setText…).
 */
MouseFollower.registerGSAP(gsap);

const SPRITE = '/cursor-sprite.svg';

let instance = null;

export const getCursor = () => instance;

export default function Cursor({ options }) {
	useEffect(() => {
		if (!window.matchMedia('(pointer: fine)').matches) return;

		const cursor = new MouseFollower({ iconSvgSrc: SPRITE, ...options });
		instance = cursor;

		return () => {
			cursor.destroy();
			if (instance === cursor) instance = null;
		};
	}, [options]);

	return null;
}

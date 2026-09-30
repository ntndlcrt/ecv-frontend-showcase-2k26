'use client';

import dynamic from 'next/dynamic';

import { useIsDesktop } from '@/libs/useIsDesktop';

// Deux chunks séparés : un mobile ne télécharge jamais le desktop (GSAP Flip,
// shader WebGL…), et inversement.
// Mobile = rendu serveur (version par défaut). Desktop = client uniquement.
const SpotlightMobile = dynamic(() => import('./SpotlightMobile'));
const SpotlightDesktop = dynamic(() => import('./SpotlightDesktop'), { ssr: false });

export default function Spotlight() {
	const isDesktop = useIsDesktop();

	if (isDesktop) return <SpotlightDesktop />;

	// Sur desktop, le HTML serveur (mobile) est masqué en CSS jusqu'à ce que le
	// client bascule → pas de flash de la version mobile avant l'intro.
	return (
		<div className="desktop:invisible">
			<SpotlightMobile />
		</div>
	);
}

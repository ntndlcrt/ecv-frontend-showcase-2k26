'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';
import { gsap, useGSAP } from '@/lib/gsap';
import { INTRO_ROUTES, onIntroEnd } from '@/lib/intro';

const LINKS = [
	{ href: '/', label: 'Projets' },
	{ href: '/a-propos', label: 'À propos' }
];

/**
 * Nav
 * ---
 * Arrive du bas : scale 0.8 / y 40 / masquée → pleine taille. Origine en bas,
 * collée au bord de l'écran → elle « pousse » depuis le bas au lieu de gonfler
 * depuis son centre. Sur une route avec intro (INTRO_ROUTES), elle attend que
 * la page émette `endIntro()` ; ailleurs elle arrive tout de suite.
 * `invisible` dans le HTML serveur → pas de flash avant l'hydratation.
 */
export default function Nav() {
	const pathname = usePathname();
	const navRef = useRef(null);

	useGSAP(
		(_, contextSafe) => {
			const nav = navRef.current;
			gsap.set(nav, { scale: 0.8, y: 40, autoAlpha: 0, transformOrigin: '50% 100%' });

			const show = contextSafe(() => {
				gsap.to(nav, { scale: 1, y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out' });
			});

			// seule la route d'arrivée compte : ensuite la nav reste en place
			if (!INTRO_ROUTES.includes(pathname)) {
				show();
				return;
			}
			return onIntroEnd(show);
		},
		{ dependencies: [] }
	);

	return (
		<div className="desktop:bottom-8 fixed bottom-4 left-1/2 z-100 -translate-x-1/2 max-lg:w-3/4">
			<nav
				ref={navRef}
				className="desktop:gap-6 desktop:px-12 desktop:py-6 desktop:text-xl invisible flex items-center rounded-xl border border-[#3E3E3E] bg-[#0d0d0d66] px-6 py-4 text-base font-medium whitespace-nowrap backdrop-blur-lg max-lg:justify-around">
				<Image
					src="/ecv.svg"
					alt="ECV"
					width={71 * 0.8}
					height={24 * 0.8}
					className="desktop:mr-6 mr-1"
				/>
				{LINKS.map(({ href, label }) => (
					<Link
						key={href}
						href={href}
						className={cn(
							'duration-200 ease-out hover:opacity-80',
							pathname === href ? 'pointer-events-none opacity-100' : 'opacity-40'
						)}>
						{label}
					</Link>
				))}
			</nav>
		</div>
	);
}

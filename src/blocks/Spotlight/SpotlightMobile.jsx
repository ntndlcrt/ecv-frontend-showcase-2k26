'use client';

import { useRef } from 'react';
import Image from 'next/image';

import AnimatedCopy from '@/components/fx/AnimatedCopy';
import { PROJECTS } from '@/data/projects';
import { gsap, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { endIntro } from '@/lib/intro';

// carte hors du centre : même retrait que les images inactives du desktop
const DIM = { scale: 0.92, opacity: 0.5 };

const pad = (n) => String(n).padStart(2, '0');

/**
 * SpotlightMobile
 * ---------------
 * Pas de pin ni de WebGL : un flux natif, pensé pour le pouce, qui reprend le
 * langage du desktop.
 *  - spotlight au scroll : la carte au centre de l'écran est pleine, les autres
 *    reculent (scale + opacité), scrubé → suit le doigt
 *  - reveal en goutte : un clip-path circle s'ouvre depuis un point de la carte
 *    pendant que l'image dézoome (équivalent DOM du reveal WebGL desktop)
 *  - noms en gooey reveal (AnimatedCopy), le nom actif passe en blanc
 * Pas de compteur global : chaque carte porte déjà son numéro.
 * Les marges haut/bas (calc svh/rem) centrent la 1re et la dernière carte.
 */
export default function SpotlightMobile() {
	const sectionRef = useRef(null);
	const cardRefs = useRef([]);
	const nameRefs = useRef([]);

	useGSAP(
		() => {
			// la nav arrive pendant le reveal des premières cartes.
			// delayedCall dans le contexte → annulé si le composant est démonté tout de
			// suite (desktop : ce rendu serveur est remplacé dès l'hydratation).
			gsap.delayedCall(0.6, endIntro);

			let active = 0;
			const setActiveName = (index) => {
				nameRefs.current.forEach((el, i) => {
					el.toggleAttribute('data-active', i === index);
				});
			};
			setActiveName(0);

			const activate = (index) => {
				if (index === active) return;
				active = index;
				setActiveName(index);
			};

			cardRefs.current.forEach((card, i) => {
				const mask = card.querySelector('[data-mask]');
				const media = card.querySelector('[data-media]');

				// spotlight : plein quand le centre de la carte croise celui de l'écran.
				// power2 out/in → plateau au centre, retrait franc en s'éloignant.
				gsap
					.timeline({
						scrollTrigger: { trigger: card, start: 'center bottom', end: 'center top', scrub: true }
					})
					.fromTo(card, DIM, { scale: 1, opacity: 1, ease: 'power2.out' })
					.to(card, { ...DIM, ease: 'power2.in' });

				// reveal en goutte : le cercle part d'un point décalé par carte, s'ouvre
				// jusqu'aux coins (75 % > demi-diagonale), l'image se pose en dézoomant
				const origin = `${40 + ((i * 37) % 21)}% ${45 + ((i * 53) % 21)}%`;
				gsap
					.timeline({ scrollTrigger: { trigger: card, start: 'top 85%', once: true } })
					.fromTo(
						mask,
						{ clipPath: `circle(0% at ${origin})` },
						{
							clipPath: `circle(75% at ${origin})`,
							duration: 1.3,
							ease: 'power2.out',
							// `none` et pas clearProps : sinon le circle(0%) de la classe revient
							onComplete: () => gsap.set(mask, { clipPath: 'none' })
						}
					)
					.fromTo(media, { scale: 1.35 }, { scale: 1.15, duration: 1.6, ease: 'power3.out' }, 0);

				// parallax : l'image glisse dans son masque (marge assurée par le scale 1.15)
				gsap.fromTo(
					media,
					{ yPercent: -6 },
					{
						yPercent: 6,
						ease: 'none',
						scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true }
					}
				);

				// actif quand la carte croise le milieu de l'écran (dans les deux sens)
				ScrollTrigger.create({
					trigger: card,
					start: 'top center',
					end: 'bottom center',
					onEnter: () => activate(i),
					onEnterBack: () => activate(i)
				});
			});
		},
		{ scope: sectionRef }
	);

	return (
		<section
			ref={sectionRef}
			className="relative px-4">
			<h1 className="sr-only">Projets</h1>

			{/* haut / bas : 50svh − ½ carte (8.5rem) → 1re et dernière carte centrées */}
			<ul className="mx-auto flex flex-col gap-8 py-[calc(50svh-8.5rem)] sm:w-[70%]">
				{PROJECTS.map((project, i) => (
					<li
						key={project.src}
						ref={(el) => (cardRefs.current[i] = el)}
						className="will-change-[transform,opacity]">
						<a
							href={project.href}
							target="_blank"
							rel="noopener noreferrer"
							className="block transition-transform duration-300 ease-out active:scale-[0.97]">
							<div
								data-mask
								className="relative aspect-[4/2.6] overflow-hidden rounded-xl [clip-path:circle(0%_at_50%_50%)]">
								<div
									data-media
									className="absolute inset-0 scale-[1.15] will-change-transform">
									<Image
										src={project.src}
										alt={project.name}
										fill
										sizes="(min-width: 640px) 70vw, 100vw"
										loading={i < 2 ? 'eager' : 'lazy'}
										fetchPriority={i === 0 ? 'high' : 'auto'}
										draggable={false}
										className="object-cover"
									/>
								</div>
							</div>

							<div className="mt-3 flex items-baseline justify-between text-xl font-medium">
								<AnimatedCopy mode="scroll">
									<p
										ref={(el) => (nameRefs.current[i] = el)}
										className="data-active:text-foreground text-[#4a4a4a] transition-colors duration-500">
										{project.name}
									</p>
								</AnimatedCopy>
								<span className="text-sm text-[#4a4a4a] tabular-nums">
									{pad(i + 1)} <span aria-hidden="true">↗</span>
								</span>
							</div>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

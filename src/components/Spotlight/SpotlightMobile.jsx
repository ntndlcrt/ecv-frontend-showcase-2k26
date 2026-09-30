'use client';

import { useRef } from 'react';
import Image from 'next/image';

import AnimatedCopy from '@/animations/AnimatedCopy';
import { PROJECTS } from '@/data/projects';
import { gsap, ScrollTrigger, useGSAP } from '@/libs/gsap';

const BLUR_IN = 'blur(0.35em)';
const BLUR_OUT = 'blur(0em)';

const pad = (n) => String(n).padStart(2, '0');

/**
 * SpotlightMobile
 * ---------------
 * Pas de pin ni de WebGL : un flux natif, pensé pour le pouce.
 *  - compteur sticky (mix-blend-difference) qui change en gooey au projet actif
 *  - chaque carte : reveal au masque (clip-path) + parallax scrubée de l'image
 *  - noms en gooey reveal (AnimatedCopy), le nom actif passe en blanc
 * Projet actif = celui qui croise le milieu du viewport.
 */
export default function SpotlightMobile() {
	const sectionRef = useRef(null);
	const counterRef = useRef(null); // <span> interne : blur gooey (le <h1> porte le filtre SVG)
	const cardRefs = useRef([]);
	const nameRefs = useRef([]);

	useGSAP(
		(_, contextSafe) => {
			const total = PROJECTS.length;
			const counter = counterRef.current;

			// intro du compteur : même reveal gooey que sur desktop
			gsap.fromTo(counter, { y: 20, filter: BLUR_IN }, { y: 0, filter: BLUR_OUT, duration: 1, ease: 'power3.out' });

			let active = 0;
			const setActiveName = (index) => {
				nameRefs.current.forEach((el, i) => {
					el.toggleAttribute('data-active', i === index);
				});
			};
			setActiveName(0);

			// changement de projet : le chiffre se dissout puis se reforme (gooey)
			let swap;
			const activate = contextSafe((index) => {
				if (index === active) return;
				active = index;
				setActiveName(index);
				swap?.kill();
				swap = gsap
					.timeline()
					.to(counter, { filter: BLUR_IN, duration: 0.2, ease: 'power2.in' })
					.add(() => {
						counter.textContent = `${pad(index + 1)}/${pad(total)}`;
					})
					.to(counter, { filter: BLUR_OUT, duration: 0.5, ease: 'power3.out' });
			});

			cardRefs.current.forEach((card, i) => {
				const mask = card.querySelector('[data-mask]');
				const media = card.querySelector('[data-media]');

				// reveal : le masque s'ouvre du bas, l'image se pose en dézoomant
				gsap
					.timeline({ scrollTrigger: { trigger: card, start: 'top 90%', once: true } })
					.fromTo(
						mask,
						{ clipPath: 'inset(100% 0% 0% 0%)' },
						{ clipPath: 'inset(0% 0% 0% 0%)', duration: 1.2, ease: 'power3.out' }
					)
					.fromTo(media, { scale: 1.4 }, { scale: 1.15, duration: 1.6, ease: 'power3.out' }, 0);

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
			className="relative px-4 pb-40">
			<header className="pointer-events-none sticky top-0 z-10 py-4 mix-blend-difference">
				<h1 className="text-[4.5rem] leading-none font-normal uppercase [filter:url(#blur-matrix)_blur(0.4px)]">
					<span
						ref={counterRef}
						className="inline-block will-change-[transform,filter]">
						01/{pad(PROJECTS.length)}
					</span>
				</h1>
			</header>

			<ul className="mt-2 flex flex-col gap-16">
				{PROJECTS.map((project, i) => (
					<li
						key={project.src}
						ref={(el) => (cardRefs.current[i] = el)}>
						<a
							href={project.href}
							target="_blank"
							rel="noopener noreferrer"
							className="block">
							<div
								data-mask
								className="relative aspect-4/3 overflow-hidden rounded-xl [clip-path:inset(100%_0%_0%_0%)]">
								<div
									data-media
									className="absolute inset-0 scale-[1.15] will-change-transform">
									<Image
										src={project.src}
										alt={project.name}
										fill
										sizes="100vw"
										loading={i < 2 ? 'eager' : 'lazy'}
										fetchPriority={i === 0 ? 'high' : 'auto'}
										draggable={false}
										className="object-cover"
									/>
								</div>
							</div>

							<div className="mt-3 flex items-baseline justify-between text-2xl font-medium">
								<AnimatedCopy mode="scroll">
									<p
										ref={(el) => (nameRefs.current[i] = el)}
										className="data-active:text-foreground text-[#4a4a4a] transition-colors duration-500">
										{project.name}
									</p>
								</AnimatedCopy>
								<span className="text-base text-[#4a4a4a] tabular-nums">{pad(i + 1)}</span>
							</div>
						</a>
					</li>
				))}
			</ul>
		</section>
	);
}

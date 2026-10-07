'use client';

import { useRef } from 'react';

import { gsap, useGSAP } from '@/lib/gsap';

const LINES = ['ECV Showcase', 'Frontend 2k26'];

/**
 * Cadre au ratio OpenGraph (1200×630) à capturer en screenshot / vidéo.
 * Clic sur le cadre → rejoue le reveal (pratique pour la capture vidéo).
 */
export default function OgCard() {
	const titleRef = useRef(null);
	const lineRefs = useRef([]);

	useGSAP(
		(_, contextSafe) => {
			const lines = lineRefs.current;

			// masque gooey posé AVANT de rendre le texte visible → pas de flash net
			gsap.set(lines, { y: '0.15em', filter: 'blur(0.35em)' });
			gsap.set(titleRef.current, { autoAlpha: 1 });

			const tl = gsap.timeline({ delay: 0.4 });
			tl.to(lines, { y: 0, filter: 'blur(0em)', duration: 1.5, ease: 'power3.out', stagger: 0.15 });

			const replay = contextSafe(() => tl.restart(true));
			const frame = titleRef.current.parentElement;
			frame.addEventListener('click', replay);
			return () => frame.removeEventListener('click', replay);
		},
		{ scope: titleRef }
	);

	return (
		<main className="grid h-svh w-full place-items-center bg-black">
			<div className="bg-background @container grid aspect-[1200/630] w-[90vw] cursor-pointer place-items-center">
				<h1
					ref={titleRef}
					className="invisible text-center text-[10cqw] leading-[0.95] font-medium tracking-tight text-white">
					{LINES.map((line, i) => (
						<span
							key={line}
							className="block [filter:url(#blur-matrix)_blur(0.4px)]">
							<span
								ref={(el) => (lineRefs.current[i] = el)}
								className="inline-block will-change-[transform,filter]">
								{line}
							</span>
						</span>
					))}
				</h1>
			</div>
		</main>
	);
}

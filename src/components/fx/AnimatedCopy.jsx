'use client';

import { useRef } from 'react';

import { gsap, SplitText, useGSAP } from '@/lib/gsap';

const BLUR_START = 'blur(0.35em)';
const BLUR_END = 'blur(0em)';

// ex-AnimatedCopy.css — classes posées par SplitText / wrapLineForBlur.
// Chaînes littérales complètes → Tailwind les détecte au scan.
// `blur-matrix` = le <filter> SVG de <GooeyFilter />, qui doit être monté.
const LINE_CLASS = 'block will-change-[filter] [filter:url(#blur-matrix)_blur(0.4px)]';
const LINE_INNER_CLASS = 'inline-block will-change-[filter]';

function wrapLineForBlur(line) {
	const inner = document.createElement('span');
	inner.className = LINE_INNER_CLASS;

	while (line.firstChild) {
		inner.appendChild(line.firstChild);
	}

	line.appendChild(inner);
	return inner;
}

export default function AnimatedCopy({ children, className, mode = 'default', delay = 0 }) {
	const containerRef = useRef(null);

	useGSAP(
		() => {
			if (!containerRef.current) return;

			// chaque enfant direct est découpé en lignes
			const targets = Array.from(containerRef.current.children);

			const splits = [];
			const blurLayers = [];

			targets.forEach((target) => {
				const split = SplitText.create(target, {
					type: 'lines',
					linesClass: LINE_CLASS
				});

				split.lines.forEach((line) => {
					blurLayers.push(wrapLineForBlur(line));
				});

				splits.push(split);
			});

			gsap.set(blurLayers, { filter: BLUR_START });

			if (mode === 'scrub') {
				gsap.to(blurLayers, {
					filter: BLUR_END,
					ease: 'power3.out',
					stagger: 0.1,
					scrollTrigger: {
						trigger: containerRef.current,
						start: 'top 75%',
						end: 'bottom 75%',
						scrub: true
					}
				});
			} else if (mode === 'scroll') {
				gsap.to(blurLayers, {
					filter: BLUR_END,
					duration: 1.5,
					ease: 'power3.out',
					stagger: 0.1,
					delay: delay,
					scrollTrigger: {
						trigger: containerRef.current,
						start: 'top 80%',
						once: true
					}
				});
			} else {
				gsap.to(blurLayers, {
					filter: BLUR_END,
					duration: 1.5,
					ease: 'power3.out',
					stagger: 0.1,
					delay: delay
				});
			}

			return () => {
				for (const split of splits) split.revert();
			};
		},
		{ scope: containerRef, dependencies: [mode, delay] }
	);

	// Toujours un wrapper, jamais de cloneElement : un enfant venu d'un Server Component
	// peut arriver en référence lazy côté client (→ type undefined, ou hydratation
	// différente du SSR si on branche dessus).
	return (
		<div
			ref={containerRef}
			className={className}>
			{children}
		</div>
	);
}

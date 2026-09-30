'use client';

import { useRef } from 'react';

import WebGLScrollBend from '@/animations/WebGLScrollBend';
import { PROJECTS } from '@/data/projects';
import { CustomEase, Flip, gsap, ScrollTrigger, useGSAP } from '@/libs/gsap';
import { startScroll, stopScroll } from '@/libs/Lenis';

const SCROLL_LENGTH = 5; // durée du scrub, en multiples de la hauteur viewport
const ACTIVE_COLOR = '#f8f8f8';
const DIM_COLOR = '#4a4a4a';
const VELOCITY_MAX = 3000; // px/s — vitesse à laquelle le gooey est au max
// em — blur max à pleine vitesse. Le seuil alpha du filtre gooey (-140/255) efface
// les traits fins au-delà de ~1.5px de blur : 0.06em ≈ 1.4px en text-2xl → gooey, jamais vide.
const BLUR_MAX = 0.06;

// ease du reveal Codegrid : lent → très rapide au milieu → posé
CustomEase.create('hop', 'M0,0 C0.355,0.022 0.448,0.079 0.5,0.5 0.542,0.846 0.615,1 1,1');

export default function SpotlightDesktop() {
	const sectionRef = useRef(null);
	const indexRef = useRef(null);
	const indexInnerRef = useRef(null); // <span> interne : intro y + blur gooey (le <h1> garde le y du scroll)
	const imagesRef = useRef(null);
	const namesRef = useRef(null);
	const imgRefs = useRef([]); // liens-wrappers des images (= éléments data-bend)
	const nameRefs = useRef([]);
	const nameInnerRefs = useRef([]); // <span> internes : intro y + blur (le <p> garde le y du scroll)

	useGSAP(
		(_, contextSafe) => {
			const total = PROJECTS.length;
			const pad = (n) => String(n).padStart(2, '0');
			const clamp01 = gsap.utils.clamp(0, 1);

			// Mesures recalculées à chaque refresh (resize, orientation, polices…).
			// L'original les figeait au montage → cassé après resize. Corrigé ici.
			const dist = { index: 0, names: 0, first: 0, step: 0 };

			const measure = () => {
				const section = sectionRef.current;
				const padY = parseFloat(getComputedStyle(section).paddingTop) || 0;
				const h = section.offsetHeight;

				dist.index = h - padY * 2 - indexRef.current.offsetHeight;
				dist.names = h - padY * 2 - namesRef.current.offsetHeight;
				// centre de la 1re image dans la colonne + pas entre deux images (hauteur + gap)
				const [a, b] = imgRefs.current;
				dist.first = a.offsetTop + a.offsetHeight / 2;
				dist.step = b.offsetTop - a.offsetTop;
			};

			const container = imagesRef.current;
			const wraps = imgRefs.current;

			// Source de vérité unique : le progress donne l'index actif, qui pilote
			// le compteur, le nom ET l'image. (L'original détectait l'image à la ligne
			// médiane : ne coïncide avec les noms que si padding = 50vh + gap/2.)
			const activeAt = (progress) => Math.min(Math.floor(progress * total), total - 1);

			// y de la colonne : centre l'image i au milieu de son créneau de progress.
			// Clampé → la 1re (resp. dernière) reste centrée en début (resp. fin).
			const clampSlot = gsap.utils.clamp(0, total - 1);
			const imagesY = (progress) =>
				window.innerHeight / 2 - (dist.first + clampSlot(progress * total - 0.5) * dist.step);

			// On pose l'opacité inline → le shader WebGL la reprend (fondu lissé).
			// Survol > actif > retrait.
			let active = 0;
			let hovered = -1;
			const paint = () => {
				wraps.forEach((wrap, i) => {
					wrap.style.opacity = i === hovered ? '0.9' : i === active ? '1' : '0.5';
				});
			};
			const updateActive = (index) => {
				active = index;
				paint();
			};

			// Survol : n'arrive qu'après l'intro (pointer-events coupés jusque-là).
			const hoverHandlers = wraps.map((wrap, i) => {
				const enter = () => {
					hovered = i;
					paint();
				};
				const leave = () => {
					if (hovered === i) hovered = -1;
					paint();
				};
				wrap.addEventListener('pointerenter', enter);
				wrap.addEventListener('pointerleave', leave);
				return () => {
					wrap.removeEventListener('pointerenter', enter);
					wrap.removeEventListener('pointerleave', leave);
				};
			});

			// ---- intro : plein écran → reveal → Flip vers la colonne ----------
			// `data-intro` = layout plein écran (classes Tailwind), `data-bend-sync` =
			// le shader suit l'opacité sans lissage. Reposés ici (idempotent) car le
			// Strict Mode rejoue l'effet après les avoir retirés.
			let introDone = false;
			let inColumn = false; // colonne en place : son y peut suivre le scroll
			container.setAttribute('data-intro', '');
			container.setAttribute('data-bend-sync', '');
			container.style.pointerEvents = 'none'; // pas de survol / clic avant la fin de l'intro
			stopScroll();
			if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
			window.scrollTo(0, 0);

			// Posé en layout effect, donc AVANT que le shader ne lise l'opacité → pas de flash.
			gsap.set(wraps, { autoAlpha: 0, scale: 1.5 });
			gsap.set(namesRef.current, { autoAlpha: 0 });

			// Intro des noms : y 10 → 0 + reveal gooey, décalé de 0.1s par nom.
			// Anime le <span> interne → pas de conflit avec le y du ScrollTrigger sur le <p>.
			// Blur de chaque nom = intro + vitesse de scroll. Un seul endroit écrit
			// `filter` (renderBlur) → l'intro et la vitesse ne s'écrasent pas.
			const spans = nameInnerRefs.current;
			const blur = spans.map(() => ({ intro: 0.35, vel: 0 }));
			const renderBlur = (i) => {
				spans[i].style.filter = `blur(${blur[i].intro + blur[i].vel}em)`;
			};
			const renderAll = () => {
				for (let i = 0; i < spans.length; i++) renderBlur(i);
			};
			renderAll();

			// compteur : même reveal gooey que les noms (pas de blur de vitesse)
			const indexSpan = indexInnerRef.current;
			const indexBlur = { intro: 0.35 };
			const renderIndexBlur = () => {
				indexSpan.style.filter = `blur(${indexBlur.intro}em)`;
			};
			renderIndexBlur();

			// quickTo par nom : lisse la montée/descente du blur de vitesse
			const setVel = blur.map((b, i) =>
				gsap.quickTo(b, 'vel', { duration: 0.4, ease: 'power3.out', onUpdate: () => renderBlur(i) })
			);
			const velToBlur = gsap.utils.pipe(
				gsap.utils.mapRange(0, VELOCITY_MAX, 0, BLUR_MAX),
				gsap.utils.clamp(0, BLUR_MAX)
			);
			// filet de sécurité : si onUpdate cesse, on retombe à 0
			let velReset;

			const intro = gsap.timeline({ paused: true });
			intro
				.to(namesRef.current, { autoAlpha: 1, duration: 0.6, ease: 'power2.out' }, 0)
				.fromTo(indexSpan, { y: 20 }, { y: 0, duration: 1, ease: 'power3.out' }, 0)
				.to(indexBlur, { intro: 0, duration: 1, ease: 'power3.out', onUpdate: renderIndexBlur }, 0)
				.fromTo(spans, { y: 20 }, { y: 0, duration: 1, ease: 'power3.out', stagger: 0.1 }, 0)
				.to(blur, { intro: 0, duration: 1, ease: 'power3.out', stagger: 0.1, onUpdate: renderAll }, 0);

			// fin de l'intro des noms : « on est sur le premier projet » →
			// 1er nom en blanc + les autres images en retrait, puis on rend le scroll.
			const settle = contextSafe(() => {
				const tl = gsap.timeline({
					onComplete: () => {
						container.removeAttribute('data-bend-sync'); // retour au fondu lissé
						introDone = true;
						container.style.pointerEvents = '';
						startScroll();
					}
				});
				tl.to(wraps.slice(1), { opacity: 0.5, duration: 0.8, ease: 'power2.inOut' });
				tl.to(nameRefs.current[0], { color: ACTIVE_COLOR, duration: 0.8, ease: 'power2.inOut' }, 0);
			});
			// démarre 0.2s avant la fin du reveal des noms → pas de temps mort
			intro.add(settle, intro.duration() - 0.2);

			const flipToColumn = contextSafe(() => {
				const state = Flip.getState(wraps, { props: 'borderRadius' });

				// layout final (colonne, rounded-xl) → Flip anime depuis le plein écran
				container.removeAttribute('data-intro');
				gsap.set(wraps, { clearProps: 'transform' });
				// colonne positionnée sur la 1re image avant que Flip lise la cible
				measure();
				gsap.set(container, { y: imagesY(0) });
				inColumn = true;

				// toutes les images restent à opacité 1 pendant le Flip
				const flip = Flip.from(state, {
					duration: 2,
					ease: 'hop',
					absolute: true,
					stagger: { amount: 0.3, from: 'end' }, // celle du dessus part en premier
					onComplete: () => ScrollTrigger.refresh() // mesures faussées tant qu'on était en plein écran
				});
				// les noms démarrent 0.2s avant que la dernière image soit en place
				flip.add(() => intro.play(), flip.duration() - 0.2);
			});

			// reveal : chaque image passe autoAlpha 0 → 1 et scale 1.5 → 1.
			// Stagger en power2.out → les écarts rétrécissent, ça accélère.
			const reveal = gsap.timeline({ paused: true });
			reveal
				.to(wraps, {
					autoAlpha: 1,
					scale: 1,
					duration: 1.25,
					ease: 'power3.out',
					stagger: { amount: 1.8, ease: 'power2.out' }
				})
				.add(flipToColumn);

			// on attend les images : le shader n'affiche un plan qu'une fois sa texture prête
			let cancelled = false;
			const loaded = wraps.map((wrap) => {
				const img = wrap.querySelector('img');
				if (img.complete) return null;
				return new Promise((resolve) => {
					img.addEventListener('load', resolve, { once: true });
					img.addEventListener('error', resolve, { once: true });
				});
			});
			Promise.all(loaded).then(() => {
				if (!cancelled) reveal.play();
			});

			let lastIndex = -1;

			// pendant le scroll : survol coupé → pas d'image à 0.9 qui défile sous le curseur.
			// Rendu dès que onUpdate cesse (fin du scroll + du rattrapage du scrub).
			let scrolling = false;
			let pointerRestore;
			const onScrollActivity = () => {
				if (!scrolling) {
					scrolling = true;
					hovered = -1;
					container.style.pointerEvents = 'none';
				}
				pointerRestore?.kill();
				pointerRestore = gsap.delayedCall(0.15, () => {
					scrolling = false;
					container.style.pointerEvents = '';
				});
			};

			ScrollTrigger.create({
				trigger: sectionRef.current,
				start: 'top top',
				end: () => `+=${window.innerHeight * 1.5 * SCROLL_LENGTH}`,
				pin: true,
				pinSpacing: true,
				scrub: 1,
				invalidateOnRefresh: true,
				onRefresh: measure,
				onUpdate: (self) => {
					const progress = self.progress;

					// compteur d'index — écrit dans le DOM seulement quand il change
					const active = activeAt(progress);
					const current = active + 1;
					if (current !== lastIndex) {
						indexInnerRef.current.textContent = `${pad(current)}/${pad(total)}`;
						lastIndex = current;
					}

					gsap.set(indexRef.current, { y: progress * dist.index });
					if (inColumn) gsap.set(container, { y: imagesY(progress) });
					if (introDone) {
						onScrollActivity();
						updateActive(active);
					}

					// gooey selon la vitesse — uniquement sur les noms immobiles (en haut / en bas)
					const velBlur = velToBlur(Math.abs(self.getVelocity()));

					nameRefs.current.forEach((el, i) => {
						const local = clamp01((progress - i / total) / (1 / total));
						const moving = i === active;
						gsap.set(el, { y: -local * dist.names });
						if (introDone) {
							gsap.set(el, { color: moving ? ACTIVE_COLOR : DIM_COLOR });
						}
						setVel[i](moving ? 0 : velBlur);
					});

					velReset?.kill();
					velReset = gsap.delayedCall(0.15, () => {
						for (const set of setVel) set(0);
					});
				}
			});

			measure();
			// recalage une fois tout chargé (les images pèsent sur les hauteurs)
			ScrollTrigger.refresh();

			return () => {
				cancelled = true;
				pointerRestore?.kill();
				velReset?.kill();
				for (const off of hoverHandlers) off();
				startScroll();
			};
		},
		{ scope: sectionRef }
	);

	// Le shader scanne les [data-bend] à son montage : il vit donc ici, monté
	// avec les images (le composant est chargé à la volée, après le 1er rendu).
	// Ses effets passent après le layout effect de useGSAP → l'opacité 0 est déjà posée.
	return (
		<>
			<WebGLScrollBend />
			<section
				ref={sectionRef}
				className="relative z-10 h-svh w-full overflow-hidden p-8">
				<h1
					ref={indexRef}
					className="pointer-events-none text-[clamp(3rem,5vw,7rem)] leading-none font-normal uppercase [filter:url(#blur-matrix)_blur(0.4px)] will-change-transform">
					<span
						ref={indexInnerRef}
						className="inline-block will-change-[transform,filter]">
						01/{String(PROJECTS.length).padStart(2, '0')}
					</span>
				</h1>

				<div
					ref={imagesRef}
					data-intro=""
					data-bend-sync=""
					className="group absolute inset-x-0 top-0 -z-10 mx-auto flex w-[50%] flex-col gap-4 py-[20svh] will-change-transform data-intro:inset-0 data-intro:w-full! data-intro:py-0!">
					{PROJECTS.map((project, i) => (
						<a
							key={project.src}
							ref={(el) => (imgRefs.current[i] = el)}
							href={project.href}
							target="_blank"
							rel="noopener noreferrer"
							data-bend
							data-cursor-icon="arrow"
							className="block aspect-[4/2.6] w-full overflow-hidden rounded-xl group-data-intro:absolute group-data-intro:inset-0 group-data-intro:aspect-auto group-data-intro:rounded-none">
							{/* eslint-disable-next-line @next/next/no-img-element -- OGL a besoin de l'élément média brut */}
							<img
								src={project.src}
								alt={project.name}
								draggable={false}
								className="h-full w-full object-cover"
							/>
						</a>
					))}
				</div>

				<div
					ref={namesRef}
					className="pointer-events-none absolute right-8 bottom-8 flex flex-col items-end">
					{PROJECTS.map((project, i) => (
						<p
							key={project.name}
							ref={(el) => (nameRefs.current[i] = el)}
							className="text-2xl leading-tight font-medium text-[#4a4a4a] [filter:url(#blur-matrix)_blur(0.4px)] will-change-transform">
							<span
								ref={(el) => (nameInnerRefs.current[i] = el)}
								className="inline-block will-change-[transform,filter]">
								{project.name}
							</span>
						</p>
					))}
				</div>
			</section>
		</>
	);
}

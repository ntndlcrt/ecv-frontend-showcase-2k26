'use client';

import { useEffect, useRef } from 'react';

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

import { gsap } from '@/lib/gsap';

/**
 * WebGLScrollBend
 * ---------------
 * Bend "à la Codrops" : la déformation en Z dépend de la position du vertex
 * DANS LE VIEWPORT (pas du plan lui-même). Le centre de l'écran bombe le plus,
 * les bords haut/bas restent plats → tout le contenu est posé sur un même
 * cylindre. L'amplitude/le sens suivent la vélocité de scroll ; plat à l'arrêt.
 *
 * Usage :
 *   1. `npm i ogl`
 *   2. Baliser les wrappers média :  <div data-bend> <img/ou video/> </div>
 *   3. Monter UNE fois, haut dans l'arbre :  <WebGLScrollBend />
 *
 * Rendu sur le ticker GSAP → calé sur Lenis, donc pas de jitter.
 *
 * NOUVEAU : chaque item lit l'opacité inline de son wrapper (celle que GSAP
 * pose côté DOM) et la pousse dans le shader via `uOpacity`. La logique
 * d'opacité vit donc côté React/GSAP ; le WebGL ne fait que suivre. Idéal
 * pour un effet actif/inactif comme le spotlight.
 *
 * Le border-radius est relu à chaque frame → un Flip/tween sur `borderRadius`
 * est suivi par le masque. Idem pour un `clip-path: inset(...)` inline (posé
 * par GSAP) → les reveals en clip-path fonctionnent côté WebGL.
 *
 * Reveal gooey : la variable CSS inline `--goo` (0 → 1) du wrapper pilote une
 * goutte qui s'étale depuis un point proche du centre (bord ondulé par du bruit,
 * antialiasé), avec un ménisque qui réfracte l'image au bord et un léger zoom
 * qui se pose. Absente = 1 = image pleine.
 *
 * Survol gooey : la variable CSS inline `--hover` (0 → 1) du wrapper fait onduler
 * le bord (même bruit que les blobs du reveal) et zoome légèrement l'image
 * dedans. Absente = 0 = bord net. Sous un ancêtre `[data-bend-sync]`, l'opacité est
 * appliquée telle quelle (pas de lissage) → utile quand GSAP la tween déjà.
 * Les plans se chevauchent sans depth test : ordre DOM = ordre de dessin.
 */
export default function WebGLScrollBend({
	selector = '[data-bend]',
	strength = 120, // amplitude max de la bosse (px) au centre du viewport
	maxVelocity = 80, // px/frame de scroll qui donne une bosse pleine
	smoothing = 0.08, // 0..1 — plus bas = plus doux, retour plus long
	opacitySmoothing = 0.12, // lissage du fondu actif/inactif côté GPU
	segments = 40, // subdivisions verticales ; plus = courbe plus lisse
	dpr = 2,
	className = 'pointer-events-none fixed inset-0 z-0'
} = {}) {
	const containerRef = useRef(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		// `prefers-reduced-motion` → on garde le rendu (les images restent nettes)
		// mais on désactive la bosse : la courbe reste plate.
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		// Canvas neuf à chaque mount → contexte neuf (le Strict Mode monte 2× en dev,
		// et réutiliser le canvas refile un contexte WebGL mort à OGL).
		const canvas = document.createElement('canvas');
		canvas.style.display = 'block';
		container.appendChild(canvas);

		const renderer = new Renderer({
			canvas,
			alpha: true,
			dpr: Math.min(window.devicePixelRatio || 1, dpr)
		});
		const gl = renderer.gl;
		// Distance caméra fixe. Le far par défaut d'OGL est 100 : il DOIT dépasser
		// cette distance, sinon les plans sont clippés et le canvas reste vide.
		const PERSPECTIVE = 1000;
		const camera = new Camera(gl, { fov: 45, near: 1, far: 4000 });
		camera.position.z = PERSPECTIVE;
		const scene = new Transform();

		// ---- shaders ------------------------------------------------------
		const vertex = /* glsl */ `
			#define PI 3.1415926535897932384626433832795
			precision highp float;
			attribute vec3 position;
			attribute vec2 uv;
			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;
			uniform float uStrength;        // vélocité de scroll signée × amplitude
			uniform vec2 uViewportSizes;    // largeur/hauteur du viewport (px)
			varying vec2 vUv;
			void main() {
				vec4 newPosition = modelViewMatrix * vec4(position, 1.0);
				// z dépend de la position du vertex DANS le viewport :
				// centre écran → sin=1 (bombe max), bords haut/bas → sin=0 (plat)
				newPosition.z += sin(newPosition.y / uViewportSizes.y * PI + PI / 2.0) * -uStrength;
				vUv = uv;
				gl_Position = projectionMatrix * newPosition;
			}
		`;
		const fragment = /* glsl */ `
			precision highp float;
			uniform sampler2D uTexture;
			uniform vec2 uPlaneSize;
			uniform vec2 uImageSize;
			uniform float uRadius;
			uniform float uOpacity;         // fondu actif/inactif piloté par le DOM
			uniform vec4 uClip;             // clip-path inset du wrapper (px) : haut, droite, bas, gauche
			uniform float uGoo;             // reveal gooey : 0 = rien, 1 = image pleine
			uniform float uSeed;            // décale le bruit → chaque image a ses propres blobs
			uniform float uHover;           // survol gooey : 0 = bord net, 1 = bord liquide + zoom
			uniform float uTime;            // fait dériver le bruit du bord au survol
			varying vec2 vUv;

			// simplex 2D — Ashima Arts / Stefan Gustavson (MIT)
			vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
			float snoise(vec2 v) {
				const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
				vec2 i = floor(v + dot(v, C.yy));
				vec2 x0 = v - i + dot(i, C.xx);
				vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
				vec4 x12 = x0.xyxy + C.xxzz;
				x12.xy -= i1;
				i = mod(i, 289.0);
				vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
				vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
				m = m * m;
				m = m * m;
				vec3 x = 2.0 * fract(p * C.www) - 1.0;
				vec3 h = abs(x) - 0.5;
				vec3 ox = floor(x + 0.5);
				vec3 a0 = x - ox;
				m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
				vec3 g;
				g.x = a0.x * x0.x + h.x * x0.y;
				g.yz = a0.yz * x12.xz + h.yz * x12.yw;
				return 130.0 * dot(m, g);
			}

			void main() {
				// object-fit: cover
				vec2 ratio = vec2(
					min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
					min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
				);
				vec2 uv = vec2(
					vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
					vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
				);
				// survol : léger zoom dans le masque (centré, reste dans la texture)
				uv = (uv - 0.5) / (1.0 + 0.06 * uHover) + 0.5;
				vec2 halfSize = uPlaneSize * 0.5;
				vec2 pp = (vUv - 0.5) * uPlaneSize; // px depuis le centre du plan

				// reveal gooey : goutte qui s'étale depuis un point décalé par image.
				// Rayon proportionnel à uGoo, bord ondulé PROPORTIONNEL au rayon → la
				// forme reste une seule goutte, jamais trouée. Distance au bord en px →
				// antialiasing propre (pas de seuil dur qui crénelle).
				float goo = 1.0 - uGoo;
				float dropEdge = -1.0e4; // < 0 = dedans
				if (goo > 0.0) {
					float halfDiag = length(halfSize);
					vec2 rel = pp - vec2(sin(uSeed), cos(uSeed * 1.37)) * 0.2 * halfSize;
					float len = max(length(rel), 1e-4);
					vec2 dir = rel / len;
					float n = snoise(dir * 1.6 + uSeed + uGoo * 1.2) * 0.7
						+ snoise(dir * 3.5 - uSeed - uGoo * 0.8) * 0.3;
					float radius = uGoo * 1.5 * halfDiag * (1.0 + 0.18 * n); // 1.5 → couvre les coins
					dropEdge = len - radius;

					// ménisque : près du bord, on échantillonne vers le centre de la goutte →
					// l'image s'étire vers l'extérieur comme à travers une lentille d'eau.
					float rim = exp(min(dropEdge, 0.0) / 40.0) * goo;
					uv -= dir * rim * 30.0 / uPlaneSize * ratio;
					// zoom qui se pose : 1.12 → 1
					uv = (uv - 0.5) / (1.0 + 0.12 * goo * goo) + 0.5;
				}
				vec4 color = texture2D(uTexture, uv);

				// masque coins arrondis (suit le border-radius du wrapper)
				vec2 q = abs(pp) - (halfSize - uRadius);
				float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
				// survol : le bord ondule vers l'intérieur (0 → 2×12px), jamais au-delà
				// du plan → pas coupé par la géométrie. Bruit lent qui dérive avec le temps.
				if (uHover > 0.0) {
					vec2 e = pp / min(uPlaneSize.x, uPlaneSize.y);
					float w = snoise(e * 2.2 + uSeed + uTime * 0.35) * 0.7
						+ snoise(e * 5.0 - uSeed - uTime * 0.5) * 0.3;
					d += uHover * 12.0 * (1.0 - w);
				}
				float alpha = 1.0 - smoothstep(0.0, 1.5, d);

				// clip-path inset (vUv.y = 0 en bas du plan)
				vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uPlaneSize;
				alpha *= step(uClip.w, px.x) * step(px.x, uPlaneSize.x - uClip.y);
				alpha *= step(uClip.x, px.y) * step(px.y, uPlaneSize.y - uClip.z);

				// masque de la goutte (bord antialiasé sur ~2px)
				if (goo > 0.0) {
					alpha *= (1.0 - smoothstep(-1.0, 1.0, dropEdge)) * step(0.0001, uGoo); // rien tant que le reveal n'a pas démarré
				}

				gl_FragColor = vec4(color.rgb, color.a * alpha * uOpacity);
			}
		`;

		// `inset(a b c d)` inline → [haut, droite, bas, gauche] en px (1 à 4 valeurs, % ou px)
		function parseInset(value, w, h) {
			const m = /^inset\(([^)]*)\)/.exec(value);
			if (!m) return [0, 0, 0, 0];
			const v = m[1]
				.split(/\s+round\s+/)[0]
				.trim()
				.split(/\s+/);
			const [t, r = t, b = t, l = r] = v;
			const px = (s, size) => (s.endsWith('%') ? (parseFloat(s) / 100) * size : parseFloat(s) || 0);
			return [px(t, h), px(r, w), px(b, h), px(l, w)];
		}

		// `--goo` inline (posé / tweené par GSAP) ; absent = 1 = image pleine
		function readGoo(el) {
			const v = el.style.getPropertyValue('--goo');
			return v === '' ? 1 : Math.min(1, Math.max(0, parseFloat(v)));
		}

		// ---- un item par élément balisé -----------------------------------
		const items = [];

		function buildItem(el) {
			const media = el.querySelector('img, video');
			if (!media) return;

			const isVideo = media.tagName === 'VIDEO';
			const index = items.length;

			// mipmaps sur les images : une grosse photo affichée petite (grille de l'intro)
			// sinon crénèle / fourmille. Pas sur les vidéos (regénérées à chaque frame).
			const texture = new Texture(gl, {
				generateMipmaps: !isVideo,
				wrapS: gl.CLAMP_TO_EDGE,
				wrapT: gl.CLAMP_TO_EDGE,
				minFilter: isVideo ? gl.LINEAR : gl.LINEAR_MIPMAP_LINEAR,
				magFilter: gl.LINEAR
			});

			// opacité de départ = ce que le DOM porte déjà (posé par GSAP avant paint)
			const startOpacity = el.style.opacity === '' ? 1 : parseFloat(el.style.opacity);

			const program = new Program(gl, {
				vertex,
				fragment,
				transparent: true,
				depthTest: false, // plans coplanaires qui se chevauchent (intro plein écran)
				uniforms: {
					uTexture: { value: texture },
					uStrength: { value: 0 },
					uViewportSizes: { value: [window.innerWidth, window.innerHeight] },
					uPlaneSize: { value: [1, 1] },
					uImageSize: { value: [1, 1] },
					uRadius: { value: 0 },
					uOpacity: { value: startOpacity },
					uClip: { value: [0, 0, 0, 0] },
					uGoo: { value: readGoo(el) },
					uSeed: { value: index * 17.31 },
					uHover: { value: 0 },
					uTime: { value: 0 }
				}
			});

			const mesh = new Mesh(gl, {
				// la déformation ne varie qu'en Y → 1 segment en largeur suffit
				geometry: new Plane(gl, { widthSegments: 1, heightSegments: segments }),
				program
			});
			mesh.visible = false; // affiché une fois la texture prête
			mesh.renderOrder = index + 1; // élément suivant dans le DOM = dessiné par-dessus
			mesh.setParent(scene);

			const item = { el, media, mesh, program, texture, isVideo, ready: false, opacity: startOpacity };
			items.push(item);

			const markReady = (w, h) => {
				texture.image = media;
				texture.needsUpdate = true;
				program.uniforms.uImageSize.value = [w || 1, h || 1];
				item.ready = true;
				mesh.visible = true;
				media.style.opacity = '0'; // cache la copie DOM, garde le layout
			};

			if (isVideo) {
				if (media.readyState >= 2) markReady(media.videoWidth, media.videoHeight);
				else media.addEventListener('loadeddata', () => markReady(media.videoWidth, media.videoHeight), { once: true });
			} else {
				if (media.complete && media.naturalWidth) markReady(media.naturalWidth, media.naturalHeight);
				else media.addEventListener('load', () => markReady(media.naturalWidth, media.naturalHeight), { once: true });
			}
		}

		document.querySelectorAll(selector).forEach(buildItem);

		// ---- caméra ------------------------------------------------------
		function resize() {
			renderer.setSize(window.innerWidth, window.innerHeight);
			// fov calculé pour que 1 unité monde == 1 px CSS à la distance PERSPECTIVE
			const fov = (2 * Math.atan(window.innerHeight / 2 / PERSPECTIVE) * 180) / Math.PI;
			camera.perspective({ fov, aspect: gl.canvas.width / gl.canvas.height });
		}
		window.addEventListener('resize', resize);
		resize();

		// ---- boucle de rendu (sur le ticker GSAP → calé sur Lenis) --------
		// Une SEULE vélocité globale de scroll pilote toute la courbe.
		let scrollY = window.scrollY;
		let vel = 0;

		function update(time) {
			const vw = window.innerWidth;
			const vh = window.innerHeight;

			const y = window.scrollY; // Lenis met à jour le scroll natif → OK
			const raw = y - scrollY; // scroll bas → positif
			scrollY = y;
			const target = Math.max(-1, Math.min(1, raw / maxVelocity));
			vel += (target - vel) * smoothing;
			const strengthValue = reduceMotion ? 0 : vel * strength;

			for (const it of items) {
				if (!it.ready) continue;
				const r = it.el.getBoundingClientRect();
				it.mesh.visible = r.bottom > -100 && r.top < vh + 100;
				if (!it.mesh.visible) continue;

				it.mesh.position.set(r.left + r.width / 2 - vw / 2, -(r.top + r.height / 2 - vh / 2), 0);
				it.mesh.scale.set(r.width, r.height, 1);

				// opacité : on suit l'inline posé côté DOM, avec un lissage GPU
				const targetOpacity = it.el.style.opacity === '' ? 1 : parseFloat(it.el.style.opacity);
				const sync = it.el.closest('[data-bend-sync]');
				it.opacity += (targetOpacity - it.opacity) * (sync ? 1 : opacitySmoothing);

				const u = it.program.uniforms;
				u.uPlaneSize.value = [r.width, r.height];
				u.uViewportSizes.value = [vw, vh];
				u.uStrength.value = strengthValue;
				u.uOpacity.value = it.opacity;
				u.uRadius.value = parseFloat(getComputedStyle(it.el).borderTopLeftRadius) || 0;
				u.uClip.value = parseInset(it.el.style.clipPath, r.width, r.height);
				u.uGoo.value = readGoo(it.el);
				u.uHover.value = parseFloat(it.el.style.getPropertyValue('--hover')) || 0;
				u.uTime.value = time;

				if (it.isVideo && !it.media.paused && it.media.readyState >= 2) {
					it.texture.needsUpdate = true;
				}
			}

			renderer.render({ scene, camera });
		}

		gsap.ticker.add(update);

		// ---- cleanup ------------------------------------------------------
		return () => {
			gsap.ticker.remove(update);
			window.removeEventListener('resize', resize);
			items.forEach((it) => {
				it.media.style.opacity = '';
			});
			gl.getExtension('WEBGL_lose_context')?.loseContext();
			canvas.remove();
		};
	}, [selector, strength, maxVelocity, smoothing, opacitySmoothing, segments, dpr]);

	return (
		<div
			ref={containerRef}
			className={className}
			aria-hidden="true"
		/>
	);
}

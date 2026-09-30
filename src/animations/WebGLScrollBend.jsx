'use client';

import { useEffect, useRef } from 'react';

import { Camera, Mesh, Plane, Program, Renderer, Texture, Transform } from 'ogl';

import { gsap } from '@/libs/gsap';

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
 * est suivi par le masque. Sous un ancêtre `[data-bend-sync]`, l'opacité est
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
			varying vec2 vUv;
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
				vec4 color = texture2D(uTexture, uv);

				// masque coins arrondis (suit le border-radius du wrapper)
				vec2 halfSize = uPlaneSize * 0.5;
				vec2 pp = (vUv - 0.5) * uPlaneSize;
				vec2 q = abs(pp) - (halfSize - uRadius);
				float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
				float alpha = 1.0 - smoothstep(0.0, 1.5, d);

				gl_FragColor = vec4(color.rgb, color.a * alpha * uOpacity);
			}
		`;

		// ---- un item par élément balisé -----------------------------------
		const items = [];

		function buildItem(el) {
			const media = el.querySelector('img, video');
			if (!media) return;

			const isVideo = media.tagName === 'VIDEO';
			const index = items.length;

			const texture = new Texture(gl, {
				generateMipmaps: false,
				wrapS: gl.CLAMP_TO_EDGE,
				wrapT: gl.CLAMP_TO_EDGE,
				minFilter: gl.LINEAR,
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
					uOpacity: { value: startOpacity }
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

		function update() {
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

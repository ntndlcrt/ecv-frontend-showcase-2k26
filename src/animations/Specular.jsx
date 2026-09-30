'use client';

import { useEffect, useRef } from 'react';

import { Mesh, Program, Renderer, Triangle } from 'ogl';

const PAD = 20;

// Parse any CSS color to [r, g, b, a] in 0..1. Handles #rgb / #rgba / #rrggbb /
// #rrggbbaa and rgb()/rgba() directly; anything else (named colors, hsl(), etc.)
// falls back to the browser. Results are cached since colors rarely change.
const colorCache = new Map();
let parseCtx = null;

function parseColor(input) {
	const key = input.trim();
	const cached = colorCache.get(key);
	if (cached) return cached;

	let out = null;

	if (key[0] === '#') {
		let h = key.slice(1);
		if (h.length === 3 || h.length === 4)
			h = h
				.split('')
				.map((c) => c + c)
				.join('');
		if (h.length === 6 || h.length === 8) {
			const r = parseInt(h.slice(0, 2), 16) / 255;
			const g = parseInt(h.slice(2, 4), 16) / 255;
			const b = parseInt(h.slice(4, 6), 16) / 255;
			const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
			if (![r, g, b, a].some(Number.isNaN)) out = [r, g, b, a];
		}
	} else {
		const m = key.match(/^rgba?\(([^)]+)\)$/i);
		if (m) {
			const parts = m[1].split(/[\s,/]+/).filter(Boolean);
			const chan = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
			const r = chan(parts[0]) / 255;
			const g = chan(parts[1]) / 255;
			const b = chan(parts[2]) / 255;
			const a = parts.length > 3 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
			if (![r, g, b, a].some(Number.isNaN)) out = [r, g, b, a];
		}
	}

	if (!out) {
		if (!parseCtx) {
			const c = document.createElement('canvas');
			c.width = c.height = 1;
			parseCtx = c.getContext('2d', { willReadFrequently: true });
		}
		if (parseCtx) {
			parseCtx.clearRect(0, 0, 1, 1);
			parseCtx.fillStyle = '#000';
			parseCtx.fillStyle = key;
			parseCtx.fillRect(0, 0, 1, 1);
			const d = parseCtx.getImageData(0, 0, 1, 1).data;
			out = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
		} else {
			out = [1, 1, 1, 1];
		}
	}

	colorCache.set(key, out);
	return out;
}

const VERT = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform float uRadius;
uniform float uAngle;
uniform float uPx;
uniform vec3 uLineColor;
uniform vec3 uBaseColor;
uniform float uIntensity;
uniform float uShineSize;
uniform float uShineFade;
uniform float uThickness;
uniform float uBaseWidth;
uniform float uLineAlpha;
uniform float uBaseAlpha;

out vec4 fragColor;

float sdRoundedRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float shapeSDF(vec2 p) { return sdRoundedRect(p, uHalfSize, uRadius); }

float gaussianLine(float d, float sigma) {
  float x = d / (sigma + 1e-6);
  float k = mix(1.0, 1.6, smoothstep(0.0, 1.5, x));
  return exp(-k * x * x);
}

void main() {
  vec2 p = gl_FragCoord.xy - uCenter;
  float d = shapeSDF(p);
  vec2 L = vec2(cos(uAngle), sin(uAngle));

  // Dark base stroke hugging the edge for a sense of thickness
  float base = (1.0 - smoothstep(0.0, uBaseWidth, abs(d))) * 0.45;

  // Symmetric specular: the edges facing toward/away from the light both
  // catch a streak. The angular window (size + fade) is measured with an
  // elliptical normal so it varies continuously along straight edges.
  vec2 nEll = normalize(p / (uHalfSize * uHalfSize) + 1e-6);
  float phi = acos(clamp(abs(dot(nEll, L)), 0.0, 1.0));
  float rim = 1.0 - smoothstep(uShineSize - uShineFade, uShineSize + uShineFade + 1e-4, phi);
  float line = gaussianLine(d, uThickness);
  float edgeClamp = 1.0 - smoothstep(0.5 * uPx, 3.0 * uPx, abs(d));
  float hi = line * rim * edgeClamp * uIntensity;

  float baseCov = base * uBaseAlpha;
  float hiCov = hi * uLineAlpha;
  vec3 col = uBaseColor * baseCov + uLineColor * hiCov;
  float a = clamp(baseCov + hiCov, 0.0, 1.0);
  fragColor = vec4(col, a);
}
`;

const Specular = ({
	children,
	radius = 18, // rayon du trait : le caler sur le border-radius de l'enfant
	tint = '#ffffff',
	tintOpacity = 0,
	blur = 0,
	lineColor = '#ffffff',
	baseColor = '#525252',
	intensity = 1,
	shineSize = 10,
	shineFade = 40,
	thickness = 1,
	speed = 0.35,
	followMouse = true,
	proximity = 250,
	autoAnimate = false,
	className = '',
	style
}) => {
	const hostRef = useRef(null);
	const fxRef = useRef(null);
	const shaderProps = {
		radius,
		lineColor,
		baseColor,
		intensity,
		shineSize,
		shineFade,
		thickness,
		speed,
		followMouse,
		proximity,
		autoAnimate
	};

	// The rAF loop reads the latest props off the ref instead of restarting on every change.
	const propsRef = useRef(shaderProps);
	useEffect(() => {
		propsRef.current = shaderProps;
	});

	useEffect(() => {
		const host = hostRef.current;
		const fx = fxRef.current;
		if (!host || !fx) return;

		const dpr = window.devicePixelRatio || 1;
		const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr });
		const gl = renderer.gl;
		gl.clearColor(0, 0, 0, 0);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

		const geometry = new Triangle(gl);
		delete geometry.attributes.uv;

		const program = new Program(gl, {
			vertex: VERT,
			fragment: FRAG,
			uniforms: {
				uCenter: { value: [0, 0] },
				uHalfSize: { value: [1, 1] },
				uRadius: { value: 0 },
				uAngle: { value: 2.4 },
				uPx: { value: dpr },
				uLineColor: { value: [1, 1, 1] },
				uBaseColor: { value: [0.32, 0.32, 0.32] },
				uIntensity: { value: 1 },
				uShineSize: { value: 0.17 },
				uShineFade: { value: 0.7 },
				uThickness: { value: 1 },
				uLineAlpha: { value: 1 },
				uBaseAlpha: { value: 1 },
				uBaseWidth: { value: dpr }
			}
		});

		const mesh = new Mesh(gl, { geometry, program });
		fx.appendChild(gl.canvas);

		const sizeRef = { w: 1, h: 1 };
		const resize = () => {
			// Fractional size + explicit center keep the SDF pinned to the exact
			// CSS border, instead of drifting up to a pixel from offsetWidth rounding.
			const rect = host.getBoundingClientRect();
			const w = rect.width;
			const h = rect.height;
			sizeRef.w = w;
			sizeRef.h = h;
			renderer.setSize(w + PAD * 2, h + PAD * 2);
			program.uniforms.uCenter.value = [(PAD + w / 2) * dpr, (PAD + h / 2) * dpr];
			program.uniforms.uHalfSize.value = [(w / 2) * dpr, (h / 2) * dpr];
		};
		const ro = new ResizeObserver(resize);
		ro.observe(host);
		resize();

		// Light angle steers toward the pointer (anywhere on the page) and falls
		// back to a slow sweep when the pointer hasn't moved yet.
		let pointerAngle = null;
		let proximityT = 0;
		const onPointerMove = (e) => {
			const rect = host.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dx = Math.max(rect.left - e.clientX, 0, e.clientX - rect.right);
			const dy = Math.max(rect.top - e.clientY, 0, e.clientY - rect.bottom);
			const dist = Math.hypot(dx, dy);
			// Over the element itself the light settles on the diagonal (framing the
			// corners) and gently sways with the cursor position within it.
			if (dist === 0) {
				const nx = (e.clientX - cx) / (rect.width / 2);
				const ny = (cy - e.clientY) / (rect.height / 2);
				pointerAngle = Math.atan2(2 / rect.height, -2 / rect.width) + nx * 0.3 + ny * 0.15;
			} else {
				pointerAngle = Math.atan2(cy - e.clientY, e.clientX - cx);
			}
			const t = Math.max(0, 1 - dist / Math.max(propsRef.current.proximity, 1));
			proximityT = t * t * (3 - 2 * t);
		};
		window.addEventListener('pointermove', onPointerMove);

		let angle = 2.4;
		let idleAngle = 2.4;
		let bright = 0;
		let last = performance.now();
		let raf = 0;

		const update = (now) => {
			raf = requestAnimationFrame(update);
			const dt = Math.min((now - last) / 1000, 0.05);
			last = now;
			const p = propsRef.current;

			idleAngle += p.speed * dt;
			const shouldSteer = p.followMouse && (!p.autoAnimate || proximityT > 0);
			const target = shouldSteer && pointerAngle !== null ? pointerAngle : idleAngle;
			const diff = ((target - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
			angle += diff * (1 - Math.exp(-dt * 7));

			// Shine fades in with pointer proximity unless autoAnimate keeps it on
			const brightTarget = p.autoAnimate ? 1 : proximityT;
			bright += (brightTarget - bright) * (1 - Math.exp(-dt * 8));

			const [lr, lg, lb, la] = parseColor(p.lineColor);
			const [br, bg, bb, ba] = parseColor(p.baseColor);
			program.uniforms.uAngle.value = angle;
			program.uniforms.uRadius.value = Math.min(p.radius, Math.min(sizeRef.w, sizeRef.h) / 2) * dpr;
			program.uniforms.uLineColor.value = [lr, lg, lb];
			program.uniforms.uBaseColor.value = [br, bg, bb];
			program.uniforms.uLineAlpha.value = la;
			program.uniforms.uBaseAlpha.value = ba;
			program.uniforms.uIntensity.value = p.intensity * bright;
			program.uniforms.uShineSize.value = (p.shineSize * Math.PI) / 180;
			program.uniforms.uShineFade.value = (p.shineFade * Math.PI) / 180;
			program.uniforms.uThickness.value = p.thickness * dpr;
			renderer.render({ scene: mesh });
		};
		raf = requestAnimationFrame(update);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener('pointermove', onPointerMove);
			if (gl.canvas.parentNode === fx) fx.removeChild(gl.canvas);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		};
	}, []);

	return (
		<div
			ref={hostRef}
			className={`relative inline-flex rounded-(--sb-radius) [background:color-mix(in_srgb,var(--sb-tint)_calc(var(--sb-tint-opacity)*100%),transparent)] [backdrop-filter:blur(var(--sb-blur))]${className ? ` ${className}` : ''}`}
			style={{
				'--sb-radius': `${radius}px`,
				'--sb-tint': tint,
				'--sb-tint-opacity': tintOpacity,
				'--sb-blur': `${blur}px`,
				...style
			}}>
			{children}
			<span
				ref={fxRef}
				aria-hidden="true"
				className="pointer-events-none absolute -inset-5 z-10 [&_canvas]:block [&_canvas]:h-full [&_canvas]:w-full"
			/>
		</div>
	);
};

export default Specular;

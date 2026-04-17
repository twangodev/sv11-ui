<script lang="ts">
	import { T, useTask, useThrelte } from "@threlte/core";
	import { useTexture } from "@threlte/extras";
	import { onMount } from "svelte";
	import * as THREE from "three";
	import { mode } from "mode-watcher";
	import type { OrbAgentState } from "./types.js";
	import fragmentShader from "./shaders/orb.frag.glsl?raw";
	import vertexShader from "./shaders/orb.vert.glsl?raw";

	type Props = {
		colors: [string, string];
		seed: number;
		agentState: OrbAgentState;
		volumeMode: "auto" | "manual";
		manualInput?: number;
		manualOutput?: number;
		getInputVolume?: () => number;
		getOutputVolume?: () => number;
	};

	let {
		colors,
		seed,
		agentState,
		volumeMode,
		manualInput,
		manualOutput,
		getInputVolume,
		getOutputVolume,
	}: Props = $props();

	const { canvas, renderer } = useThrelte();

	let mesh = $state.raw<THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>>();

	// Non-reactive refs (upstream's useRef equivalents)
	const targetColor1 = new THREE.Color(colors[0]);
	const targetColor2 = new THREE.Color(colors[1]);
	let curIn = 0;
	let curOut = 0;
	let animSpeed = 0.1;
	const offsets = makeOffsets(seed);

	// Reactively update target colors when `colors` prop changes (upstream lines 142-145)
	$effect(() => {
		targetColor1.set(colors[0]);
		targetColor2.set(colors[1]);
	});

	// WebGL context-lost handler (upstream lines 220-231)
	onMount(() => {
		const onLost = (e: Event) => {
			e.preventDefault();
			setTimeout(() => renderer.forceContextRestore(), 1);
		};
		canvas.addEventListener("webglcontextlost", onLost, false);
		return () => canvas.removeEventListener("webglcontextlost", onLost, false);
	});

	// Load perlin texture with tiling enabled (upstream line 101-103 + line 234-235)
	const texture = useTexture("https://svagent.ui.twango.dev/orbs/perlin-noise.png", {
		transform: (t) => {
			t.wrapS = THREE.RepeatWrapping;
			t.wrapT = THREE.RepeatWrapping;
			t.colorSpace = THREE.NoColorSpace;
			return t;
		},
	});

	// Build uniforms object once (upstream lines 233-251)
	function makeUniforms(perlinTexture: THREE.Texture<HTMLImageElement>) {
		return {
			uColor1: new THREE.Uniform(new THREE.Color(colors[0])),
			uColor2: new THREE.Uniform(new THREE.Color(colors[1])),
			uOffsets: { value: offsets },
			uPerlinTexture: new THREE.Uniform(perlinTexture),
			uTime: new THREE.Uniform(0),
			uAnimation: new THREE.Uniform(0.1),
			uInverted: new THREE.Uniform(mode.current === "dark" ? 1 : 0),
			uInputVolume: new THREE.Uniform(0),
			uOutputVolume: new THREE.Uniform(0),
			uOpacity: new THREE.Uniform(0),
		};
	}

	// Per-frame update — byte-equivalent to upstream useFrame (lines 164-218)
	useTask((delta) => {
		const mat = mesh?.material;
		if (!mat) return;
		const u = mat.uniforms;
		u.uTime.value += delta * 0.5;

		if (u.uOpacity.value < 1) {
			u.uOpacity.value = Math.min(1, u.uOpacity.value + delta * 2);
		}

		let targetIn = 0;
		let targetOut = 0.3;
		if (volumeMode === "manual") {
			targetIn = clamp01(manualInput ?? getInputVolume?.() ?? 0);
			targetOut = clamp01(manualOutput ?? getOutputVolume?.() ?? 0);
		} else {
			const t = u.uTime.value * 2;
			if (agentState === null) {
				targetIn = 0;
				targetOut = 0.3;
			} else if (agentState === "listening") {
				targetIn = clamp01(0.55 + Math.sin(t * 3.2) * 0.35);
				targetOut = 0.45;
			} else if (agentState === "talking") {
				targetIn = clamp01(0.65 + Math.sin(t * 4.8) * 0.22);
				targetOut = clamp01(0.75 + Math.sin(t * 3.6) * 0.22);
			} else {
				const base = 0.38 + 0.07 * Math.sin(t * 0.7);
				const wander = 0.05 * Math.sin(t * 2.1) * Math.sin(t * 0.37 + 1.2);
				targetIn = clamp01(base + wander);
				targetOut = clamp01(0.48 + 0.12 * Math.sin(t * 1.05 + 0.6));
			}
		}

		curIn += (targetIn - curIn) * 0.2;
		curOut += (targetOut - curOut) * 0.2;

		const targetSpeed = 0.1 + (1 - Math.pow(curOut - 1, 2)) * 0.9;
		animSpeed += (targetSpeed - animSpeed) * 0.12;

		u.uAnimation.value += delta * animSpeed;
		u.uInputVolume.value = curIn;
		u.uOutputVolume.value = curOut;
		u.uInverted.value = mode.current === "dark" ? 1 : 0;
		u.uColor1.value.lerp(targetColor1, 0.08);
		u.uColor2.value.lerp(targetColor2, 0.08);
	});

	// Upstream splitmix32 (lines 266-276) — byte-for-byte
	function splitmix32(a: number) {
		return function () {
			a |= 0;
			a = (a + 0x9e3779b9) | 0;
			let t = a ^ (a >>> 16);
			t = Math.imul(t, 0x21f0aaad);
			t = t ^ (t >>> 15);
			t = Math.imul(t, 0x735a2d97);
			return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
		};
	}

	function makeOffsets(s: number): Float32Array {
		const rng = splitmix32(s);
		return new Float32Array(Array.from({ length: 7 }, () => rng() * Math.PI * 2));
	}

	// Upstream clamp01 (lines 278-281)
	function clamp01(n: number) {
		if (!Number.isFinite(n)) return 0;
		return Math.min(1, Math.max(0, n));
	}
</script>

{#await $texture then perlinTexture}
	{#if perlinTexture}
		<T.Mesh bind:ref={mesh}>
			<T.CircleGeometry args={[3.5, 64]} />
			<T.ShaderMaterial
				uniforms={makeUniforms(perlinTexture)}
				{fragmentShader}
				{vertexShader}
				transparent
			/>
		</T.Mesh>
	{/if}
{/await}

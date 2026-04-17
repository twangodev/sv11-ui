<script lang="ts">
	import { Orb } from "$lib/registry/ui/orb/index.js";

	let {
		seed,
		side,
		isDark,
		audioDataRef,
		isPlaying,
		volume,
	}: {
		seed: number;
		side: "left" | "right";
		isDark: boolean;
		audioDataRef: { current: number[] };
		isPlaying: { current: boolean };
		volume: { current: number };
	} = $props();

	const colors = $derived<[string, string]>(
		isDark ? ["#A0A0A0", "#232323"] : ["#F4F4F4", "#E0E0E0"]
	);

	function getInputVolume(): number {
		const audioData = audioDataRef.current;
		if (!isPlaying.current || volume.current === 0 || audioData.length === 0) return 0;
		const lowFreqEnd = Math.floor(audioData.length * 0.25);
		let sum = 0;
		for (let i = 0; i < lowFreqEnd; i++) sum += audioData[i];
		const avgLow = sum / lowFreqEnd;
		const amplified = Math.pow(avgLow, 0.5) * 3.5;
		return Math.max(0.2, Math.min(1.0, amplified));
	}

	function getOutputVolume(): number {
		const audioData = audioDataRef.current;
		if (!isPlaying.current || volume.current === 0 || audioData.length === 0) return 0;
		const midStart = Math.floor(audioData.length * 0.25);
		const midEnd = Math.floor(audioData.length * 0.75);
		let sum = 0;
		for (let i = midStart; i < midEnd; i++) sum += audioData[i];
		const avgMid = sum / (midEnd - midStart);
		const modifier = side === "left" ? 0.9 : 1.1;
		const amplified = Math.pow(avgMid, 0.5) * 4.0;
		return Math.max(0.25, Math.min(1.0, amplified * modifier));
	}
</script>

<Orb {colors} {seed} volumeMode="manual" {getInputVolume} {getOutputVolume} />

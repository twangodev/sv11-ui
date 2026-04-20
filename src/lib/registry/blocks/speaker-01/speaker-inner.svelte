<script lang="ts">
	import { untrack } from "svelte";
	import Music from "@lucide/svelte/icons/music";
	import SkipBack from "@lucide/svelte/icons/skip-back";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import Volume from "@lucide/svelte/icons/volume";
	import Volume1 from "@lucide/svelte/icons/volume-1";
	import Volume2 from "@lucide/svelte/icons/volume-2";
	import VolumeX from "@lucide/svelte/icons/volume-x";
	import {
		AudioGraph,
		AudioPlayerButton,
		AudioPlayerDuration,
		AudioPlayerProgress,
		AudioPlayerTime,
		exampleTracks,
		precomputeWaveform as decodeAndSampleWaveform,
		useAudioPlayer,
	} from "$lib/registry/ui/audio-player/index.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { Waveform } from "$lib/registry/ui/waveform/index.js";
	import { cn } from "$lib/utils.js";
	import SpeakerOrb from "./speaker-orb.svelte";
	import { useScratchableWaveform } from "./use-scratchable-waveform.svelte.js";

	let { class: className }: { class?: string } = $props();

	const player = useAudioPlayer<{ name: string }>();
	const graph = new AudioGraph();

	let currentTrackIndex = $state(0);
	let showTrackList = $state(false);
	let ambienceMode = $state(false);
	let volume = $state(0.7);
	let isDark = $state(false);

	const audioDataRef: { current: number[] } = $state({ current: [] });
	const isPlayingRef: { current: boolean } = $state({ current: false });
	const volumeRef: { current: number } = $state({ current: 0.7 });

	const BARS_PER_SECOND = 8;
	const BAR_STEP = 5;
	let precomputedWaveform = $state<number[]>([]);
	let loadedTrackId = $state<string | null>(null);
	let containerWidthRef = { current: 300 };
	let waveformContainerEl = $state<HTMLDivElement | null>(null);
	const totalWidth = $derived(precomputedWaveform.length * BAR_STEP);

	const scrub = useScratchableWaveform({
		player,
		graph,
		trackUrl: () => exampleTracks[currentTrackIndex]?.url ?? null,
		totalWidth: () => totalWidth,
		containerWidth: () => containerWidthRef.current,
	});

	$effect(() => {
		volumeRef.current = volume;
	});

	let waveformRequestId = 0;
	async function loadWaveform(track: (typeof exampleTracks)[number]) {
		const requestId = ++waveformRequestId;
		let bars: number[] | null = null;

		if (track.waveform && track.waveform.length > 0) {
			bars = track.waveform;
		} else if (track.waveformUrl) {
			try {
				const response = await fetch(track.waveformUrl);
				if (response.ok) {
					const json = await response.json();
					if (Array.isArray(json)) bars = json;
				}
			} catch {
				// fall through to client decode
			}
		}

		if (!bars) {
			try {
				bars = await decodeAndSampleWaveform(track.url, BARS_PER_SECOND);
			} catch (error) {
				console.error("Error decoding waveform:", error);
				return;
			}
		}

		if (requestId === waveformRequestId) {
			precomputedWaveform = bars;
			loadedTrackId = track.id;
		}
	}

	$effect(() => {
		const measure = () => {
			if (waveformContainerEl) {
				containerWidthRef.current = waveformContainerEl.getBoundingClientRect().width;
			}
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	});

	$effect(() => {
		if (loadedTrackId !== null && containerWidthRef.current > 0) {
			scrub.offset = containerWidthRef.current;
		}
	});

	$effect(() => {
		untrack(() => void loadWaveform(exampleTracks[0]));
	});

	$effect(() => {
		if (!player.audio) return;
		untrack(() => {
			const track = exampleTracks[0];
			void player.setActiveItem({ id: track.id, src: track.url, data: { name: track.name } });
		});
	});

	// Playhead RAF: only drives offset when the user isn't driving it themselves.
	$effect(() => {
		let animationId: number;
		const update = () => {
			if (!scrub.isScrubbing && !scrub.isMomentumActive) {
				const audio = player.audio;
				if (audio && !isNaN(audio.duration) && audio.duration > 0) {
					const position = audio.currentTime / audio.duration;
					scrub.offset = containerWidthRef.current - position * totalWidth;
				}
			}
			animationId = requestAnimationFrame(update);
		};
		animationId = requestAnimationFrame(update);
		return () => cancelAnimationFrame(animationId);
	});

	$effect(() => {
		isPlayingRef.current = player.isPlaying;
	});

	$effect(() => {
		if (player.audio) player.audio.volume = volume;
	});

	$effect(() => {
		const check = () => {
			isDark = document.documentElement.classList.contains("dark");
		};
		check();
		const observer = new MutationObserver(check);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	});

	$effect(() => {
		const audioEl = player.audio;
		if (!audioEl) return;
		const handleStart = () => graph.ensureAnalyser(audioEl);
		audioEl.addEventListener("play", handleStart);
		return () => {
			audioEl.removeEventListener("play", handleStart);
			graph.destroy();
			scrub.reset();
		};
	});

	$effect(() => {
		let animationId: number;
		const loop = () => {
			const analyser = graph.analyser;
			if (analyser && isPlayingRef.current) {
				const arr = new Uint8Array(analyser.frequencyBinCount);
				analyser.getByteFrequencyData(arr);
				audioDataRef.current = Array.from(arr).map((v) => v / 255);
			} else if (!isPlayingRef.current && audioDataRef.current.length > 0) {
				audioDataRef.current = audioDataRef.current.map((v) => v * 0.9);
			}
			animationId = requestAnimationFrame(loop);
		};
		animationId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(animationId);
	});

	function playTrack(index: number) {
		currentTrackIndex = index;
		const track = exampleTracks[index];
		void player.play({ id: track.id, src: track.url, data: { name: track.name } });
		showTrackList = false;
		scrub.reset();
		void loadWaveform(track);
	}

	function nextTrack() {
		playTrack((currentTrackIndex + 1) % exampleTracks.length);
	}

	function prevTrack() {
		playTrack((currentTrackIndex - 1 + exampleTracks.length) % exampleTracks.length);
	}

	const tracks = exampleTracks.map((t) => ({
		id: t.id,
		title: t.name,
		artist: "ElevenLabs Music",
	}));
	const currentTrack = $derived(tracks[currentTrackIndex]);

	const VolumeIcon = $derived(
		volume === 0 ? VolumeX : volume <= 0.33 ? Volume : volume <= 0.66 ? Volume1 : Volume2
	);

	const scrubberValue = $derived.by(() => {
		const audio = player.audio;
		if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return 0;
		return Math.round((audio.currentTime / audio.duration) * 100);
	});

	function handleVolumeClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLDivElement;
		const rect = target.getBoundingClientRect();
		volume = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
	}
</script>

<Card class={cn("relative", className)}>
	<div
		class="bg-muted-foreground/30 absolute top-0 left-1/2 h-3 w-48 -translate-x-1/2 rounded-b-full"
	></div>
	<div
		class="bg-muted-foreground/20 absolute top-0 left-1/2 h-2 w-44 -translate-x-1/2 rounded-b-full"
	></div>

	<div class="relative space-y-6 p-4">
		<div class="border-border rounded-lg border bg-black/5 p-4 backdrop-blur-sm dark:bg-black/50">
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<div class="min-w-0 flex-1">
						<h3 class="text-foreground truncate text-sm font-medium">{currentTrack.title}</h3>
						<p class="text-muted-foreground truncate text-xs">{currentTrack.artist}</p>
					</div>
					<div class="flex gap-1">
						<Button
							variant="ghost"
							size="icon"
							class={cn(
								"h-8 w-8 transition-all",
								ambienceMode
									? "text-primary hover:text-primary/80"
									: "text-muted-foreground hover:text-foreground"
							)}
							onclick={() => (ambienceMode = !ambienceMode)}
						>
							<Sparkles class="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:text-foreground h-8 w-8"
							onclick={() => (showTrackList = !showTrackList)}
						>
							<Music class="h-4 w-4" />
						</Button>
					</div>
				</div>

				<div
					bind:this={waveformContainerEl}
					class="waveform-container bg-foreground/10 relative h-12 cursor-grab touch-none overflow-hidden rounded-lg p-2 select-none active:cursor-grabbing dark:bg-black/80"
					role="slider"
					tabindex="0"
					aria-label="Seek playback"
					aria-valuemin="0"
					aria-valuemax="100"
					aria-valuenow={scrubberValue}
					onpointerdown={scrub.handlePointerDown}
					onkeydown={scrub.handleKeyDown}
				>
					<div class="relative h-full w-full overflow-hidden">
						<div
							style:transform="translateX({scrub.offset}px)"
							style:transition={scrub.isScrubbing || scrub.isMomentumActive
								? "none"
								: "transform 0.016s linear"}
							style:width="{totalWidth}px"
							style:position="absolute"
							style:left="0"
						>
							<Waveform
								data={precomputedWaveform.length > 0 ? precomputedWaveform : audioDataRef.current}
								height={32}
								barWidth={3}
								barGap={2}
								fadeEdges={true}
								fadeWidth={24}
								barRadius={1}
								barColor={isDark ? "#a1a1aa" : "#71717a"}
							/>
						</div>
					</div>
				</div>

				<div class="flex items-center gap-2">
					<AudioPlayerTime class="text-xs" />
					<AudioPlayerProgress class="flex-1" />
					<AudioPlayerDuration class="text-xs" />
				</div>
			</div>
		</div>

		{#if showTrackList}
			<div
				class="bg-card/95 border-border absolute top-36 right-8 left-8 z-10 rounded-lg border p-3 shadow-xl backdrop-blur"
			>
				<h4 class="text-muted-foreground mb-2 font-mono text-xs tracking-wider uppercase">
					Playlist
				</h4>
				<div class="max-h-32 space-y-1 overflow-y-auto">
					{#each tracks as track, index (track.id)}
						<button
							type="button"
							onclick={() => playTrack(index)}
							class={cn(
								"w-full rounded px-2 py-1 text-left text-xs transition-all",
								currentTrackIndex === index
									? "bg-foreground/10 text-foreground dark:bg-primary/20 dark:text-primary"
									: "hover:bg-muted text-muted-foreground"
							)}
						>
							<div class="flex items-center gap-2">
								<span class="text-muted-foreground/60">{index + 1}</span>
								<div class="min-w-0 flex-1">
									<div class="truncate">{track.title}</div>
									<div class="text-muted-foreground/60 truncate text-xs">{track.artist}</div>
								</div>
							</div>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="flex justify-center gap-3">
			<Button
				variant="outline"
				size="icon"
				class="border-border bg-background hover:bg-muted h-10 w-10 rounded-full"
				onclick={prevTrack}
			>
				<SkipBack class="text-muted-foreground h-4 w-4" />
			</Button>
			<AudioPlayerButton
				variant="outline"
				size="icon"
				item={{
					id: exampleTracks[currentTrackIndex].id,
					src: exampleTracks[currentTrackIndex].url,
					data: { name: exampleTracks[currentTrackIndex].name },
				}}
				class={cn(
					"border-border h-14 w-14 rounded-full transition-all duration-300",
					player.isPlaying
						? "bg-foreground/10 hover:bg-foreground/15 border-foreground/30 dark:bg-primary/20 dark:hover:bg-primary/30 dark:border-primary/50"
						: "bg-background hover:bg-muted"
				)}
			/>
			<Button
				variant="outline"
				size="icon"
				class="border-border bg-background hover:bg-muted h-10 w-10 rounded-full"
				onclick={nextTrack}
			>
				<SkipForward class="text-muted-foreground h-4 w-4" />
			</Button>
		</div>

		<div class="mt-8 grid grid-cols-2 gap-8">
			<div class="relative aspect-square">
				<div
					class="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
				>
					<div
						class="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]"
					>
						<SpeakerOrb
							seed={100}
							side="left"
							{isDark}
							{audioDataRef}
							isPlaying={isPlayingRef}
							volume={volumeRef}
						/>
					</div>
				</div>
			</div>
			<div class="relative aspect-square">
				<div
					class="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
				>
					<div
						class="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]"
					>
						<SpeakerOrb
							seed={2000}
							side="right"
							{isDark}
							{audioDataRef}
							isPlaying={isPlayingRef}
							volume={volumeRef}
						/>
					</div>
				</div>
			</div>
		</div>

		<div class="flex items-center justify-center gap-4 pt-4">
			<button
				type="button"
				onclick={() => (volume = volume > 0 ? 0 : 0.7)}
				class="text-muted-foreground hover:text-foreground transition-colors"
				aria-label="Toggle mute"
			>
				<VolumeIcon
					class={cn("h-4 w-4 transition-all", volume === 0 && "text-muted-foreground/50")}
				/>
			</button>
			<div
				class="bg-foreground/10 group relative h-1 w-48 cursor-pointer rounded-full"
				role="slider"
				tabindex="0"
				aria-label="Volume"
				aria-valuemin="0"
				aria-valuemax="100"
				aria-valuenow={Math.round(volume * 100)}
				onclick={handleVolumeClick}
				onkeydown={(e) => {
					if (e.key === "ArrowLeft") volume = Math.max(0, volume - 0.05);
					if (e.key === "ArrowRight") volume = Math.min(1, volume + 0.05);
				}}
			>
				<div
					class="bg-primary absolute top-0 left-0 h-full rounded-full transition-all duration-150"
					style:width="{volume * 100}%"
				></div>
			</div>
			<span class="text-muted-foreground w-12 text-right font-mono text-xs">
				{Math.round(volume * 100)}%
			</span>
		</div>
	</div>
</Card>

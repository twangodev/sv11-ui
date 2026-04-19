<script lang="ts">
	import Music from "@lucide/svelte/icons/music";
	import SkipBack from "@lucide/svelte/icons/skip-back";
	import SkipForward from "@lucide/svelte/icons/skip-forward";
	import Sparkles from "@lucide/svelte/icons/sparkles";
	import Volume from "@lucide/svelte/icons/volume";
	import Volume1 from "@lucide/svelte/icons/volume-1";
	import Volume2 from "@lucide/svelte/icons/volume-2";
	import VolumeX from "@lucide/svelte/icons/volume-x";
	import {
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

	let { class: className }: { class?: string } = $props();

	const player = useAudioPlayer<{ name: string }>();

	let currentTrackIndex = $state(0);
	let showTrackList = $state(false);
	let ambienceMode = $state(false);
	let volume = $state(0.7);
	let isDark = $state(false);

	// Refs-as-objects so child components share a single mutable reference.
	const audioDataRef: { current: number[] } = $state({ current: [] });
	const isPlayingRef: { current: boolean } = $state({ current: false });
	const volumeRef: { current: number } = $state({ current: 0.7 });

	// Scrolling waveform state. `BARS_PER_SECOND` keeps scroll speed and detail
	// consistent across tracks of different lengths; the strip width is derived
	// from the loaded waveform's actual bar count.
	const BARS_PER_SECOND = 8;
	const BAR_STEP = 5; // barWidth(3) + barGap(2)
	let precomputedWaveform = $state<number[]>([]);
	// Tracks which track the loaded waveform belongs to so we only reset the
	// playhead when the track actually changes — not when a late-resolving
	// waveform lands for a track the user is already listening to.
	let loadedTrackId = $state<string | null>(null);
	let lastResetTrackId: string | null = null;
	let waveformOffset = $state(0);
	let containerWidthRef = { current: 300 };
	let waveformEl = $state<HTMLDivElement | null>(null);
	let waveformContainerEl = $state<HTMLDivElement | null>(null);
	const totalWidth = $derived(precomputedWaveform.length * BAR_STEP);

	// Scrub / momentum interaction state. While either flag is true the playhead
	// RAF stops driving `waveformOffset` so user input wins; the pointer handler
	// restores playback once momentum settles.
	let isScrubbing = $state(false);
	let isMomentumActive = $state(false);
	// Raw decoded PCM of the current track — used only for scratch playback.
	// Decoded lazily alongside the visual waveform so a missing buffer gracefully
	// degrades to silent scrubbing instead of blocking the UI.
	let scratchAudioBuffer: AudioBuffer | null = null;
	let scratchSource: AudioBufferSourceNode | null = null;

	// Keep volumeRef in sync with the reactive state.
	$effect(() => {
		volumeRef.current = volume;
	});

	/**
	 * Resolve a track's waveform in priority order:
	 *   1. `track.waveform` — inline array, zero I/O
	 *   2. `track.waveformUrl` — fetch a small JSON
	 *   3. Decode the mp3 client-side via `OfflineAudioContext` (slow fallback)
	 *
	 * Each call tags its own request id so a fast track-switch discards stale
	 * results instead of overwriting the active waveform.
	 */
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
				// Network or parse error — fall through to the client decode path.
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

		// Background-decode the raw PCM for scratch playback. This runs
		// independently of the visual waveform — scratch gracefully degrades to
		// silent scrubbing if the decode fails or the user scrubs before it
		// resolves. The shipped-JSON path skips this decode entirely on the
		// visual side, so we pay one network + decode here but avoid blocking
		// initial render.
		void loadScratchBuffer(track, requestId);
	}

	async function loadScratchBuffer(track: (typeof exampleTracks)[number], requestId: number) {
		try {
			const response = await fetch(track.url);
			const arrayBuffer = await response.arrayBuffer();
			const OfflineCtx =
				window.OfflineAudioContext ||
				(window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
					.webkitOfflineAudioContext;
			const offlineContext = new OfflineCtx(1, 1, 44100);
			const buffer = await offlineContext.decodeAudioData(arrayBuffer);
			if (requestId === waveformRequestId) {
				scratchAudioBuffer = buffer;
			}
		} catch (error) {
			// Non-fatal — scrubbing still works, just silently.
			console.warn("Scratch buffer decode failed:", error);
		}
	}

	// Measure the waveform container on mount + window resize.
	$effect(() => {
		const measure = () => {
			if (waveformContainerEl) {
				const rect = waveformContainerEl.getBoundingClientRect();
				containerWidthRef.current = rect.width;
			}
		};
		measure();
		window.addEventListener("resize", measure);
		return () => window.removeEventListener("resize", measure);
	});

	// Reset playhead + offset whenever a new waveform is ready — but only if
	// the waveform belongs to a track we haven't already reset for. Otherwise
	// a late-arriving decode for the currently-playing track would rewind the
	// user mid-listen.
	$effect(() => {
		if (
			precomputedWaveform.length > 0 &&
			containerWidthRef.current > 0 &&
			loadedTrackId !== null &&
			loadedTrackId !== lastResetTrackId
		) {
			waveformOffset = containerWidthRef.current;
			if (player.audio) {
				player.audio.currentTime = 0;
			}
			lastResetTrackId = loadedTrackId;
		}
	});

	// Load the first track on mount + fetch its waveform.
	$effect(() => {
		const track = exampleTracks[0];
		void player.setActiveItem({
			id: track.id,
			src: track.url,
			data: { name: track.name },
		});
		void loadWaveform(track);
	});

	// RAF loop: translate the waveform so the playhead (right edge of container)
	// tracks the current audio time. Mirrors upstream's scroll math — position
	// normalized against `audio.duration` — so playback and waveform end-of-
	// track align even when bar count is derived from PCM duration. Skips the
	// update while the user is driving the offset manually (scrub/momentum) so
	// pointer input isn't fighting the RAF.
	$effect(() => {
		let animationId: number;
		const update = () => {
			if (!isScrubbing && !isMomentumActive) {
				const audio = player.audio;
				if (audio && !isNaN(audio.duration) && audio.duration > 0) {
					const position = audio.currentTime / audio.duration;
					waveformOffset = containerWidthRef.current - position * totalWidth;
				}
			}
			animationId = requestAnimationFrame(update);
		};
		animationId = requestAnimationFrame(update);
		return () => cancelAnimationFrame(animationId);
	});

	// Track the playing state (derived from player context).
	$effect(() => {
		isPlayingRef.current = player.isPlaying;
	});

	// Apply volume to the audio element.
	$effect(() => {
		if (player.audio) {
			player.audio.volume = volume;
		}
	});

	// Dark-mode observer.
	$effect(() => {
		const check = () => {
			isDark = document.documentElement.classList.contains("dark");
		};
		check();
		const observer = new MutationObserver(check);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	});

	// Analyser: tap the <audio> element for frequency data feeding the orbs.
	let analyser = $state<AnalyserNode | null>(null);
	let audioContext = $state<AudioContext | null>(null);
	let analyserSource: MediaElementAudioSourceNode | null = null;

	// Lazy shared context — the analyser wires it on first `play`, but scratch
	// playback needs access during pointer gestures too. Split creation from
	// graph wiring so scratch can warm the context without creating the source
	// node (only one `createMediaElementSource` per element is legal).
	function ensureAudioContext(): AudioContext | null {
		if (audioContext) return audioContext;
		try {
			const AC =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			audioContext = new AC();
		} catch (err) {
			console.error("AudioContext creation failed", err);
			return null;
		}
		return audioContext;
	}

	$effect(() => {
		const audioEl = player.audio;
		if (!audioEl) return;

		const handleStart = () => {
			if (analyserSource) return; // graph already wired
			const ctx = ensureAudioContext();
			if (!ctx) return;
			if (ctx.state === "suspended") void ctx.resume().catch(() => {});
			try {
				const source = ctx.createMediaElementSource(audioEl);
				const a = ctx.createAnalyser();
				a.fftSize = 512;
				a.smoothingTimeConstant = 0.7;
				source.connect(a);
				a.connect(ctx.destination);
				analyser = a;
				analyserSource = source;
			} catch (err) {
				console.error("analyser setup failed", err);
			}
		};

		audioEl.addEventListener("play", handleStart);
		return () => {
			audioEl.removeEventListener("play", handleStart);
			// Tear down the graph so unmount / HMR doesn't leak contexts — browsers
			// cap live AudioContexts and a long-lived session accumulates them
			// across block navigations.
			try {
				analyserSource?.disconnect();
				analyser?.disconnect();
			} catch {
				// ignore — nodes may already be gone
			}
			void audioContext?.close().catch(() => {});
			audioContext = null;
			analyser = null;
			analyserSource = null;
			scratchAudioBuffer = null;
			scratchSource = null;
		};
	});

	// RAF loop to sample analyser into audioDataRef.
	$effect(() => {
		let animationId: number;
		const loop = () => {
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

	/**
	 * Plays a short slice of the decoded track at `position` through a lowpass
	 * filter whose cutoff and playback rate scale with pointer `speed`. Mirrors
	 * upstream's turntable-scratch sound: fast pointer movement = pitched-up,
	 * brighter slice; slow = darker, near-unity rate. Each call stops the
	 * previous slice so the DJ effect is a rapid stutter, not overlapping takes.
	 */
	function playScratchSound(position: number, speed: number = 1): void {
		const ctx = ensureAudioContext();
		if (!ctx) return;
		if (ctx.state === "suspended") void ctx.resume().catch(() => {});
		if (!scratchAudioBuffer) return;

		stopScratchSound();

		try {
			const source = ctx.createBufferSource();
			source.buffer = scratchAudioBuffer;

			const startTime = Math.max(
				0,
				Math.min(scratchAudioBuffer.duration - 0.1, position * scratchAudioBuffer.duration)
			);

			const filter = ctx.createBiquadFilter();
			filter.type = "lowpass";
			filter.frequency.value = Math.max(800, 2500 - speed * 1500);
			filter.Q.value = 3;

			source.playbackRate.value = Math.max(0.4, Math.min(2.5, 1 + speed * 0.5));

			const gain = ctx.createGain();
			gain.gain.value = 1.0;

			source.connect(filter);
			filter.connect(gain);
			gain.connect(ctx.destination);

			source.start(0, startTime, 0.06);

			scratchSource = source;
		} catch (error) {
			console.error("Error playing scratch sound:", error);
		}
	}

	function stopScratchSound(): void {
		if (scratchSource) {
			try {
				scratchSource.stop();
			} catch {
				// already stopped or never started — ignore
			}
			scratchSource = null;
		}
	}

	/**
	 * Unified pointer handler covering mouse, touch, and pen. Collapses
	 * upstream's duplicated mouse/touch handlers into one via the Pointer
	 * Events API. The math mirrors the React source line-for-line so playback
	 * feel (velocity smoothing `0.6/0.4`, friction `0.92`, scratch throttles
	 * `10ms`/`50ms`) is preserved.
	 */
	function onWaveformPointerDown(e: PointerEvent): void {
		if (e.pointerType === "mouse" && e.button !== 0) return;
		e.preventDefault();

		isScrubbing = true;

		const wasPlaying = isPlayingRef.current;
		if (wasPlaying) void player.pause();

		const target = e.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		const startX = e.clientX;
		const containerWidth = rect.width;
		containerWidthRef.current = containerWidth;
		const totalW = totalWidth;
		const startOffset = waveformOffset;
		let lastPointerX = startX;
		let lastScratchTime = 0;
		const scratchThrottle = 10;

		let velocity = 0;
		let lastTime = Date.now();
		let lastClientX = e.clientX;

		const onMove = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;

			const deltaX = ev.clientX - startX;
			const newOffset = startOffset + deltaX;

			const minOffset = containerWidth - totalW;
			const maxOffset = containerWidth;
			const clampedOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));
			waveformOffset = clampedOffset;

			const position = Math.max(0, Math.min(1, (containerWidth - clampedOffset) / totalW));

			const audio = player.audio;
			if (audio && !isNaN(audio.duration)) {
				audio.currentTime = position * audio.duration;
			}

			const now = Date.now();
			const pointerDelta = ev.clientX - lastPointerX;
			const timeDelta = now - lastTime;
			if (timeDelta > 0) {
				const instantVelocity = (ev.clientX - lastClientX) / timeDelta;
				velocity = velocity * 0.6 + instantVelocity * 0.4;
			}
			lastTime = now;
			lastClientX = ev.clientX;

			if (Math.abs(pointerDelta) > 0 && now - lastScratchTime >= scratchThrottle) {
				const speed = Math.min(3, Math.abs(pointerDelta) / 3);
				playScratchSound(position, speed);
				lastScratchTime = now;
			}
			lastPointerX = ev.clientX;
		};

		const onEnd = (ev: PointerEvent) => {
			if (ev.pointerId !== e.pointerId) return;
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onEnd);
			document.removeEventListener("pointercancel", onEnd);

			isScrubbing = false;
			stopScratchSound();

			if (Math.abs(velocity) > 0.1) {
				isMomentumActive = true;
				let momentumOffset = waveformOffset;
				let currentVelocity = velocity * 15;
				const friction = 0.92;
				const minVelocity = 0.5;
				let lastScratchFrame = 0;
				const scratchFrameInterval = 50;

				const animateMomentum = () => {
					if (Math.abs(currentVelocity) > minVelocity) {
						momentumOffset += currentVelocity;
						currentVelocity *= friction;

						const minOffset = containerWidth - totalW;
						const maxOffset = containerWidth;
						const clampedOffset = Math.max(minOffset, Math.min(maxOffset, momentumOffset));
						// Hitting an edge kills the fling — matches a physical
						// turntable thudding against a hard stop.
						if (clampedOffset !== momentumOffset) currentVelocity = 0;
						momentumOffset = clampedOffset;
						waveformOffset = clampedOffset;

						const position = Math.max(0, Math.min(1, (containerWidth - clampedOffset) / totalW));
						const audio = player.audio;
						if (audio && !isNaN(audio.duration)) {
							audio.currentTime = position * audio.duration;
						}

						const now = Date.now();
						if (now - lastScratchFrame >= scratchFrameInterval) {
							const speed = Math.min(2.5, Math.abs(currentVelocity) / 10);
							if (speed > 0.1) playScratchSound(position, speed);
							lastScratchFrame = now;
						}

						requestAnimationFrame(animateMomentum);
					} else {
						stopScratchSound();
						isMomentumActive = false;
						if (wasPlaying) {
							// Upstream delays the resume by ~10ms so the final
							// scratch slice fully releases before the media
							// element starts up — prevents a crackle.
							setTimeout(() => {
								void player.play();
							}, 10);
						}
					}
				};
				requestAnimationFrame(animateMomentum);
			} else if (wasPlaying) {
				void player.play();
			}
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onEnd);
		document.addEventListener("pointercancel", onEnd);
	}

	function handleVolumeClick(event: MouseEvent) {
		const target = event.currentTarget as HTMLDivElement;
		const rect = target.getBoundingClientRect();
		const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
		volume = x;
	}

	// Expose the waveform scrubber's current position as an ARIA slider value.
	// Keyboard seek: ←/→ nudge, Home/End jump to edges.
	const scrubberValue = $derived.by(() => {
		const audio = player.audio;
		if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return 0;
		return Math.round((audio.currentTime / audio.duration) * 100);
	});

	function onScrubberKeyDown(e: KeyboardEvent) {
		const audio = player.audio;
		if (!audio || !isFinite(audio.duration) || audio.duration <= 0) return;
		const step = e.shiftKey ? 5 : 1;
		let nextPct: number | null = null;
		if (e.key === "ArrowLeft") nextPct = Math.max(0, scrubberValue - step);
		else if (e.key === "ArrowRight") nextPct = Math.min(100, scrubberValue + step);
		else if (e.key === "Home") nextPct = 0;
		else if (e.key === "End") nextPct = 100;
		if (nextPct === null) return;
		e.preventDefault();
		audio.currentTime = (nextPct / 100) * audio.duration;
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
						<h3 class="text-foreground truncate text-sm font-medium">
							{currentTrack.title}
						</h3>
						<p class="text-muted-foreground truncate text-xs">
							{currentTrack.artist}
						</p>
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
					onpointerdown={onWaveformPointerDown}
					onkeydown={onScrubberKeyDown}
				>
					<div class="relative h-full w-full overflow-hidden">
						<div
							bind:this={waveformEl}
							style:transform="translateX({waveformOffset}px)"
							style:transition={isScrubbing || isMomentumActive
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
									<div class="text-muted-foreground/60 truncate text-xs">
										{track.artist}
									</div>
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

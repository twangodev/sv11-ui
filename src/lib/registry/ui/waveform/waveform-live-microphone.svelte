<script lang="ts">
	import { onDestroy } from "svelte";
	import { cn } from "$lib/utils.js";
	import { getComputedBarColor, heightToCssSize } from "./utils.js";
	import type { ScrollingWaveformProps } from "./waveform-scrolling.svelte";

	export type LiveMicrophoneWaveformProps = Omit<ScrollingWaveformProps, "barCount"> & {
		active?: boolean;
		fftSize?: number;
		smoothingTimeConstant?: number;
		sensitivity?: number;
		onError?: (error: Error) => void;
		historySize?: number;
		updateRate?: number;
		savedHistoryRef?: { current: number[] };
		dragOffset?: number;
		setDragOffset?: (offset: number) => void;
		enableAudioPlayback?: boolean;
		playbackRate?: number;
	};

	let {
		active = false,
		fftSize = 256,
		smoothingTimeConstant = 0.8,
		sensitivity = 1,
		onError,
		historySize = 150,
		updateRate = 50,
		barWidth = 3,
		barHeight: baseBarHeight = 4,
		barGap = 1,
		barRadius = 1,
		barColor,
		fadeEdges = true,
		fadeWidth = 24,
		height = 128,
		class: className,
		savedHistoryRef,
		dragOffset: externalDragOffset,
		setDragOffset: externalSetDragOffset,
		enableAudioPlayback = true,
		playbackRate = 1,
		...restProps
	}: LiveMicrophoneWaveformProps = $props();

	let internalDragOffset = $state(0);
	let playbackPosition = $state<number | null>(null);

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	const internalHistoryRef = { current: [] as number[] };
	let analyserRef: AnalyserNode | null = null;
	let playbackContext: AudioContext | null = null;
	let captureGeneration = 0;
	let disposed = false;
	let cancelDrag: (() => void) | null = null;
	let animationRef: number | null = null;
	let lastUpdateRef = 0;
	let dragStartXRef = 0;
	let dragStartOffsetRef = 0;
	let playbackStartTimeRef = 0;

	let audioBufferRef: AudioBuffer | null = null;
	let sourceNodeRef: AudioBufferSourceNode | null = null;
	let scrubSourceRef: AudioBufferSourceNode | null = null;

	const historyRef = $derived(savedHistoryRef ?? internalHistoryRef);
	const dragOffset = $derived(externalDragOffset ?? internalDragOffset);
	const setDragOffset = (offset: number) => {
		if (externalSetDragOffset) externalSetDragOffset(offset);
		else internalDragOffset = offset;
	};

	const heightStyle = $derived(heightToCssSize(height));

	async function processAudioBlob(blob: Blob, generation: number) {
		if (!blob.size) return;
		try {
			const decoder = new OfflineAudioContext(1, 1, 44100);
			const buffer = await decoder.decodeAudioData(await blob.arrayBuffer());
			if (!disposed && generation === captureGeneration) audioBufferRef = buffer;
		} catch (error) {
			if (!disposed && generation === captureGeneration) onError?.(error as Error);
		}
	}

	function ensurePlaybackContext(): AudioContext {
		playbackContext ??= new AudioContext();
		if (playbackContext.state === "suspended") {
			void playbackContext.resume().catch((error) => onError?.(error));
		}
		return playbackContext;
	}

	function stopPlayback(): void {
		for (const source of [sourceNodeRef, scrubSourceRef]) {
			if (!source) continue;
			source.onended = null;
			try {
				source.stop();
			} catch {
				// Buffer sources can only be stopped after they start.
			}
			source.disconnect();
		}
		sourceNodeRef = null;
		scrubSourceRef = null;
		playbackPosition = null;
	}

	onDestroy(() => {
		disposed = true;
		captureGeneration += 1;
		cancelDrag?.();
		stopPlayback();
		void playbackContext?.close().catch(() => {});
		playbackContext = null;
	});

	function playScrubSound(position: number, direction: number) {
		if (!enableAudioPlayback || !audioBufferRef) return;
		const context = ensurePlaybackContext();

		if (scrubSourceRef) {
			try {
				scrubSourceRef.stop();
				scrubSourceRef.disconnect();
			} catch {
				// ignore — source may already be stopped
			}
		}

		const source = context.createBufferSource();
		source.buffer = audioBufferRef;

		const speed = Math.abs(direction);
		const rate = direction > 0 ? Math.min(3, 1 + speed * 0.1) : Math.max(-3, -1 - speed * 0.1);

		source.playbackRate.value = rate;

		const filter = context.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = Math.max(200, 2000 - speed * 100);

		source.connect(filter);
		filter.connect(context.destination);

		const startTime = Math.max(0, Math.min(position, audioBufferRef.duration - 0.1));
		source.start(0, startTime, 0.1);
		scrubSourceRef = source;
		source.onended = () => {
			source.disconnect();
			filter.disconnect();
			if (scrubSourceRef === source) scrubSourceRef = null;
		};
	}

	function playFromPosition(position: number) {
		if (!enableAudioPlayback || !audioBufferRef) return;
		const context = ensurePlaybackContext();

		if (sourceNodeRef) {
			try {
				sourceNodeRef.onended = null;
				sourceNodeRef.stop();
				sourceNodeRef.disconnect();
			} catch {
				// ignore — source may already be stopped
			}
		}

		const source = context.createBufferSource();
		source.buffer = audioBufferRef;
		source.playbackRate.value = playbackRate;
		source.connect(context.destination);

		const startTime = Math.max(0, Math.min(position, audioBufferRef.duration));
		source.start(0, startTime);
		sourceNodeRef = source;

		playbackStartTimeRef = context.currentTime;
		playbackPosition = startTime;

		source.onended = () => {
			source.disconnect();
			if (sourceNodeRef === source) {
				sourceNodeRef = null;
				playbackPosition = null;
			}
		};
	}

	$effect(() => {
		const canvas = canvasEl;
		const container = containerEl;
		if (!canvas || !container) return;

		const resizeObserver = new ResizeObserver(() => {
			const rect = container.getBoundingClientRect();
			const dpr = window.devicePixelRatio || 1;

			canvas.width = rect.width * dpr;
			canvas.height = rect.height * dpr;
			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;

			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.scale(dpr, dpr);
			}
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	});

	// Capture resources belong to this effect; playback uses its own context.
	$effect(() => {
		if (!active) return;
		const generation = ++captureGeneration;
		const captureFftSize = fftSize;
		const captureSmoothing = smoothingTimeConstant;
		const recordPlayback = enableAudioPlayback;
		const reportError = onError;
		setDragOffset(0);
		historyRef.current = [];
		audioBufferRef = null;
		cancelDrag?.();
		stopPlayback();
		void playbackContext?.close().catch(() => {});
		playbackContext = null;

		let cancelled = false;
		let stream: MediaStream | null = null;
		let context: AudioContext | null = null;
		let source: MediaStreamAudioSourceNode | null = null;
		let analyser: AnalyserNode | null = null;
		let recorder: MediaRecorder | null = null;
		const chunks: Blob[] = [];

		function releaseCapture() {
			source?.disconnect();
			analyser?.disconnect();
			if (analyserRef === analyser) analyserRef = null;
			stream?.getTracks().forEach((track) => track.stop());
			if (context && context.state !== "closed") void context.close().catch(() => {});
			source = null;
			context = null;
			stream = null;
		}

		async function setupMicrophone() {
			try {
				stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				if (cancelled) {
					releaseCapture();
					return;
				}
				context = new AudioContext();
				analyser = context.createAnalyser();
				analyser.fftSize = captureFftSize;
				analyser.smoothingTimeConstant = captureSmoothing;
				source = context.createMediaStreamSource(stream);
				source.connect(analyser);
				analyserRef = analyser;

				if (recordPlayback) {
					recorder = new MediaRecorder(stream);
					const recording = recorder;
					recording.ondataavailable = (event) => {
						if (event.data.size > 0) chunks.push(event.data);
					};
					recording.onstop = () => {
						// The final dataavailable event precedes stop.
						const blob = new Blob(chunks, { type: recording.mimeType });
						recording.ondataavailable = null;
						recording.onstop = null;
						recording.onerror = null;
						if (!disposed && generation === captureGeneration) {
							void processAudioBlob(blob, generation);
						}
					};
					recording.onerror = () => {
						if (!disposed && generation === captureGeneration) {
							reportError?.(new Error("Microphone recording failed"));
						}
						releaseCapture();
					};
					recording.start(100);
				}
			} catch (error) {
				releaseCapture();
				if (!cancelled) reportError?.(error as Error);
			}
		}

		void setupMicrophone();
		return () => {
			cancelled = true;
			try {
				if (recorder && recorder.state !== "inactive") recorder.stop();
			} finally {
				releaseCapture();
			}
		};
	});

	$effect(() => {
		if (playbackPosition === null || !audioBufferRef) return;

		const _playbackPosition = playbackPosition;
		const _playbackRate = playbackRate;
		const _barWidth = barWidth;
		const _barGap = barGap;
		const _historyRef = historyRef;

		let animationId: number | null = null;

		const updatePlaybackVisual = () => {
			if (playbackContext && sourceNodeRef && audioBufferRef) {
				const elapsed = playbackContext.currentTime - playbackStartTimeRef;
				const currentPos = _playbackPosition + elapsed * _playbackRate;

				if (currentPos < audioBufferRef.duration) {
					const progressRatio = currentPos / audioBufferRef.duration;
					const currentBarIndex = Math.floor(progressRatio * _historyRef.current.length);
					const step = _barWidth + _barGap;

					const containerWidth = containerEl?.getBoundingClientRect().width || 0;
					const viewBars = Math.floor(containerWidth / step);
					const targetOffset = -(currentBarIndex - (_historyRef.current.length - viewBars)) * step;
					const clampedOffset = Math.max(
						-(_historyRef.current.length - viewBars) * step,
						Math.min(0, targetOffset)
					);

					setDragOffset(clampedOffset);
					animationId = requestAnimationFrame(updatePlaybackVisual);
				} else {
					playbackPosition = null;
					const step = _barWidth + _barGap;
					const containerWidth = containerEl?.getBoundingClientRect().width || 0;
					const viewBars = Math.floor(containerWidth / step);
					setDragOffset(-(_historyRef.current.length - viewBars) * step);
				}
			}
		};

		animationId = requestAnimationFrame(updatePlaybackVisual);

		return () => {
			if (animationId !== null) cancelAnimationFrame(animationId);
		};
	});

	$effect(() => {
		const canvas = canvasEl;
		if (!canvas) return;

		const _active = active;
		const _sensitivity = sensitivity;
		const _updateRate = updateRate;
		const _historySize = historySize;
		const _barWidth = barWidth;
		const _baseBarHeight = baseBarHeight;
		const _barGap = barGap;
		const _barRadius = barRadius;
		const _barColor = barColor;
		const _fadeEdges = fadeEdges;
		const _fadeWidth = fadeWidth;
		const _dragOffset = dragOffset;
		const _playbackPosition = playbackPosition;
		const _historyRef = historyRef;

		if (!_active && _historyRef.current.length === 0 && _playbackPosition === null) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const animate = (currentTime: number) => {
			if (_active && currentTime - lastUpdateRef > _updateRate) {
				lastUpdateRef = currentTime;

				if (analyserRef) {
					const dataArray = new Uint8Array(analyserRef.frequencyBinCount);
					analyserRef.getByteFrequencyData(dataArray);

					let sum = 0;
					for (let i = 0; i < dataArray.length; i++) {
						sum += dataArray[i];
					}
					const average = (sum / dataArray.length / 255) * _sensitivity;

					_historyRef.current.push(Math.min(1, Math.max(0.05, average)));

					if (_historyRef.current.length > _historySize) {
						_historyRef.current.shift();
					}
				}
			}

			const rect = canvas.getBoundingClientRect();
			ctx.clearRect(0, 0, rect.width, rect.height);

			const computedBarColor = getComputedBarColor(canvas, _barColor);

			const step = _barWidth + _barGap;
			const barCount = Math.floor(rect.width / step);
			const centerY = rect.height / 2;

			const dataToRender = _historyRef.current;

			if (dataToRender.length > 0) {
				const offsetInBars = Math.floor(_dragOffset / step);

				for (let i = 0; i < barCount; i++) {
					let dataIndex: number;

					if (_active) {
						dataIndex = dataToRender.length - 1 - i;
					} else {
						dataIndex = Math.max(
							0,
							Math.min(
								dataToRender.length - 1,
								dataToRender.length - 1 - i - Math.floor(offsetInBars)
							)
						);
					}

					if (dataIndex >= 0 && dataIndex < dataToRender.length) {
						const value = dataToRender[dataIndex];
						if (value !== undefined) {
							const x = rect.width - (i + 1) * step;
							const barHeightPx = Math.max(_baseBarHeight, value * rect.height * 0.7);
							const y = centerY - barHeightPx / 2;

							ctx.fillStyle = computedBarColor;
							ctx.globalAlpha = 0.3 + value * 0.7;

							if (_barRadius > 0) {
								ctx.beginPath();
								ctx.roundRect(x, y, _barWidth, barHeightPx, _barRadius);
								ctx.fill();
							} else {
								ctx.fillRect(x, y, _barWidth, barHeightPx);
							}
						}
					}
				}
			}

			if (_fadeEdges && _fadeWidth > 0) {
				const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
				const fadePercent = Math.min(0.2, _fadeWidth / rect.width);

				gradient.addColorStop(0, "rgba(255,255,255,1)");
				gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
				gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
				gradient.addColorStop(1, "rgba(255,255,255,1)");

				ctx.globalCompositeOperation = "destination-out";
				ctx.fillStyle = gradient;
				ctx.fillRect(0, 0, rect.width, rect.height);
				ctx.globalCompositeOperation = "source-over";
			}

			ctx.globalAlpha = 1;

			animationRef = requestAnimationFrame(animate);
		};

		if (_active || _historyRef.current.length > 0 || _playbackPosition !== null) {
			animationRef = requestAnimationFrame(animate);
		}

		return () => {
			if (animationRef !== null) {
				cancelAnimationFrame(animationRef);
				animationRef = null;
			}
		};
	});

	function handlePointerDown(event: PointerEvent) {
		if (active || historyRef.current.length === 0) return;

		event.preventDefault();
		cancelDrag?.();
		dragStartXRef = event.clientX;
		dragStartOffsetRef = dragOffset;

		let lastScrubTime = 0;
		let lastMouseX = dragStartXRef;

		const handleMove = (moveEvent: PointerEvent) => {
			if (moveEvent.pointerId !== event.pointerId) return;
			const deltaX = moveEvent.clientX - dragStartXRef;
			const newOffset = dragStartOffsetRef - deltaX * 0.5;

			const step = barWidth + barGap;
			const maxBars = historyRef.current.length;
			const viewWidth = canvasEl?.getBoundingClientRect().width || 0;
			const viewBars = Math.floor(viewWidth / step);

			const maxOffset = Math.max(0, (maxBars - viewBars) * step);
			const minOffset = 0;
			const clampedOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

			setDragOffset(clampedOffset);

			const now = Date.now();
			if (enableAudioPlayback && audioBufferRef && now - lastScrubTime > 50) {
				lastScrubTime = now;
				const offsetBars = Math.floor(clampedOffset / step);
				const rightmostBarIndex = Math.max(0, Math.min(maxBars - 1, maxBars - 1 - offsetBars));
				const audioPosition = (rightmostBarIndex / maxBars) * audioBufferRef.duration;
				const direction = moveEvent.clientX - lastMouseX;
				lastMouseX = moveEvent.clientX;
				playScrubSound(
					Math.max(0, Math.min(audioBufferRef.duration - 0.1, audioPosition)),
					direction
				);
			}
		};

		const handleUp = (upEvent: PointerEvent) => {
			if (upEvent.pointerId !== event.pointerId) return;
			if (upEvent.type === "pointerup" && enableAudioPlayback && audioBufferRef) {
				const step = barWidth + barGap;
				const maxBars = historyRef.current.length;
				const offsetBars = Math.floor(dragOffset / step);
				const rightmostBarIndex = Math.max(0, Math.min(maxBars - 1, maxBars - 1 - offsetBars));
				const audioPosition = (rightmostBarIndex / maxBars) * audioBufferRef.duration;
				playFromPosition(Math.max(0, Math.min(audioBufferRef.duration - 0.1, audioPosition)));
			}

			cancelDrag?.();
		};

		cancelDrag = () => {
			if (scrubSourceRef) {
				try {
					scrubSourceRef.stop();
				} catch {
					// The scratch slice may have already ended.
				}
				scrubSourceRef.disconnect();
				scrubSourceRef = null;
			}
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
			window.removeEventListener("pointercancel", handleUp);
			cancelDrag = null;
		};
		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
		window.addEventListener("pointercancel", handleUp);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
	bind:this={containerEl}
	data-slot="live-microphone-waveform"
	class={cn(
		"relative flex items-center",
		!active && historyRef.current.length > 0 && "cursor-pointer",
		className
	)}
	role={!active && historyRef.current.length > 0 ? "slider" : undefined}
	aria-label={!active && historyRef.current.length > 0
		? "Drag to scrub through recording"
		: undefined}
	aria-valuenow={!active && historyRef.current.length > 0 ? Math.abs(dragOffset) : undefined}
	aria-valuemin={!active && historyRef.current.length > 0 ? 0 : undefined}
	aria-valuemax={!active && historyRef.current.length > 0 ? historyRef.current.length : undefined}
	tabindex={!active && historyRef.current.length > 0 ? 0 : undefined}
	style:height={heightStyle}
	onpointerdown={handlePointerDown}
	{...restProps}
>
	<canvas bind:this={canvasEl} class="block h-full w-full"></canvas>
</div>

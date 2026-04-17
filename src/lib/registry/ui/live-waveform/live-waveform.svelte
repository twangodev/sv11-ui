<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	export type LiveWaveformProps = HTMLAttributes<HTMLDivElement> & {
		/**
		 * When `true`, requests microphone access and drives the waveform from
		 * live audio input. Toggling off stops the stream and closes the
		 * audio context.
		 * @default false
		 */
		active?: boolean;
		/**
		 * When `true` (and `active` is `false`), renders an animated placeholder
		 * wave pattern. Use this to signal a processing or awaiting state.
		 * @default false
		 */
		processing?: boolean;
		/**
		 * Specific `MediaDeviceInfo.deviceId` to capture from. Omit to use the
		 * default microphone.
		 */
		deviceId?: string;
		/**
		 * Width of each bar in pixels.
		 * @default 3
		 */
		barWidth?: number;
		/**
		 * Minimum bar height in pixels. Bars are drawn at least this tall even
		 * when their value is near zero.
		 * @default 4
		 */
		barHeight?: number;
		/**
		 * Gap between bars in pixels.
		 * @default 1
		 */
		barGap?: number;
		/**
		 * Corner radius applied to each bar.
		 * @default 1.5
		 */
		barRadius?: number;
		/**
		 * Custom bar color. Falls back to the canvas's computed `color` when
		 * unset.
		 */
		barColor?: string;
		/**
		 * Fade the left and right edges of the waveform via a destination-out
		 * gradient mask.
		 * @default true
		 */
		fadeEdges?: boolean;
		/**
		 * Width of the edge fade region in pixels.
		 * @default 24
		 */
		fadeWidth?: number;
		/**
		 * Height of the waveform container. Numbers are treated as pixels;
		 * strings are passed through as a CSS length.
		 * @default 64
		 */
		height?: string | number;
		/**
		 * Amplitude multiplier applied to normalized frequency data before
		 * rendering. Higher values make quiet sounds visible.
		 * @default 1
		 */
		sensitivity?: number;
		/**
		 * Smoothing factor forwarded to the underlying `AnalyserNode` in
		 * `[0, 1]`. Higher values produce smoother transitions.
		 * @default 0.8
		 */
		smoothingTimeConstant?: number;
		/**
		 * FFT size forwarded to the underlying `AnalyserNode`. Must be a power
		 * of two.
		 * @default 256
		 */
		fftSize?: number;
		/**
		 * Maximum number of samples retained in scrolling mode.
		 * @default 60
		 */
		historySize?: number;
		/**
		 * Minimum interval in milliseconds between audio samples.
		 * @default 30
		 */
		updateRate?: number;
		/**
		 * `"static"` renders a symmetric frequency-band visualization; `"scrolling"`
		 * renders the volume average as a timeline that scrolls right-to-left.
		 * @default "static"
		 */
		mode?: "scrolling" | "static";
		/** Called when microphone setup fails (e.g. permission denied). */
		onError?: (error: Error) => void;
		/** Called with the captured `MediaStream` once the microphone is ready. */
		onStreamReady?: (stream: MediaStream) => void;
		/** Called when the stream is stopped or `active` flips back to `false`. */
		onStreamEnd?: () => void;
	};

	let {
		active = false,
		processing = false,
		deviceId,
		barWidth = 3,
		barGap = 1,
		barRadius = 1.5,
		barColor,
		fadeEdges = true,
		fadeWidth = 24,
		barHeight: baseBarHeight = 4,
		height = 64,
		sensitivity = 1,
		smoothingTimeConstant = 0.8,
		fftSize = 256,
		historySize = 60,
		updateRate = 30,
		mode = "static",
		onError,
		onStreamReady,
		onStreamEnd,
		class: className,
		...restProps
	}: LiveWaveformProps = $props();

	let canvasEl: HTMLCanvasElement | null = $state(null);
	let containerEl: HTMLDivElement | null = $state(null);

	// Non-reactive imperative refs (match React `useRef` usage).
	let historyRef: number[] = [];
	let analyserRef: AnalyserNode | null = null;
	let audioContextRef: AudioContext | null = null;
	let streamRef: MediaStream | null = null;
	let animationRef: number | null = null;
	let lastUpdateRef = 0;
	let processingAnimationRef: number | null = null;
	let fadeAnimationRef: number | null = null;
	let lastActiveDataRef: number[] = [];
	let transitionProgressRef = 0;
	let staticBarsRef: number[] = [];
	let needsRedrawRef = true;
	let gradientCacheRef: CanvasGradient | null = null;
	let lastWidthRef = 0;

	const heightStyle = $derived(typeof height === "number" ? `${height}px` : height);

	// Effect 1: Canvas resize observer (runs once on mount).
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

			gradientCacheRef = null;
			lastWidthRef = rect.width;
			needsRedrawRef = true;
		});

		resizeObserver.observe(container);
		return () => resizeObserver.disconnect();
	});

	// Effect 2: Processing animation / idle fade-out.
	$effect(() => {
		const _processing = processing;
		const _active = active;
		const _barWidth = barWidth;
		const _barGap = barGap;
		const _mode = mode;

		if (_processing && !_active) {
			let time = 0;
			transitionProgressRef = 0;

			const animateProcessing = () => {
				time += 0.03;
				transitionProgressRef = Math.min(1, transitionProgressRef + 0.02);

				const processingData: number[] = [];
				const barCount = Math.floor(
					(containerEl?.getBoundingClientRect().width || 200) / (_barWidth + _barGap)
				);

				if (_mode === "static") {
					const halfCount = Math.floor(barCount / 2);

					for (let i = 0; i < barCount; i++) {
						const normalizedPosition = (i - halfCount) / halfCount;
						const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

						const wave1 = Math.sin(time * 1.5 + normalizedPosition * 3) * 0.25;
						const wave2 = Math.sin(time * 0.8 - normalizedPosition * 2) * 0.2;
						const wave3 = Math.cos(time * 2 + normalizedPosition) * 0.15;
						const combinedWave = wave1 + wave2 + wave3;
						const processingValue = (0.2 + combinedWave) * centerWeight;

						let finalValue = processingValue;
						if (lastActiveDataRef.length > 0 && transitionProgressRef < 1) {
							const lastDataIndex = Math.min(i, lastActiveDataRef.length - 1);
							const lastValue = lastActiveDataRef[lastDataIndex] || 0;
							finalValue =
								lastValue * (1 - transitionProgressRef) + processingValue * transitionProgressRef;
						}

						processingData.push(Math.max(0.05, Math.min(1, finalValue)));
					}
				} else {
					for (let i = 0; i < barCount; i++) {
						const normalizedPosition = (i - barCount / 2) / (barCount / 2);
						const centerWeight = 1 - Math.abs(normalizedPosition) * 0.4;

						const wave1 = Math.sin(time * 1.5 + i * 0.15) * 0.25;
						const wave2 = Math.sin(time * 0.8 - i * 0.1) * 0.2;
						const wave3 = Math.cos(time * 2 + i * 0.05) * 0.15;
						const combinedWave = wave1 + wave2 + wave3;
						const processingValue = (0.2 + combinedWave) * centerWeight;

						let finalValue = processingValue;
						if (lastActiveDataRef.length > 0 && transitionProgressRef < 1) {
							const lastDataIndex = Math.floor((i / barCount) * lastActiveDataRef.length);
							const lastValue = lastActiveDataRef[lastDataIndex] || 0;
							finalValue =
								lastValue * (1 - transitionProgressRef) + processingValue * transitionProgressRef;
						}

						processingData.push(Math.max(0.05, Math.min(1, finalValue)));
					}
				}

				if (_mode === "static") {
					staticBarsRef = processingData;
				} else {
					historyRef = processingData;
				}

				needsRedrawRef = true;
				processingAnimationRef = requestAnimationFrame(animateProcessing);
			};

			animateProcessing();

			return () => {
				if (processingAnimationRef !== null) {
					cancelAnimationFrame(processingAnimationRef);
					processingAnimationRef = null;
				}
			};
		} else if (!_active && !_processing) {
			const hasData = _mode === "static" ? staticBarsRef.length > 0 : historyRef.length > 0;

			if (hasData) {
				let fadeProgress = 0;
				const fadeToIdle = () => {
					fadeProgress += 0.03;
					if (fadeProgress < 1) {
						if (_mode === "static") {
							staticBarsRef = staticBarsRef.map((value) => value * (1 - fadeProgress));
						} else {
							historyRef = historyRef.map((value) => value * (1 - fadeProgress));
						}
						needsRedrawRef = true;
						fadeAnimationRef = requestAnimationFrame(fadeToIdle);
					} else {
						if (_mode === "static") {
							staticBarsRef = [];
						} else {
							historyRef = [];
						}
						fadeAnimationRef = null;
					}
				};
				fadeAnimationRef = requestAnimationFrame(fadeToIdle);

				return () => {
					if (fadeAnimationRef !== null) {
						cancelAnimationFrame(fadeAnimationRef);
						fadeAnimationRef = null;
					}
				};
			}
		}
	});

	// Effect 3: Microphone setup/teardown.
	$effect(() => {
		const _active = active;
		const _deviceId = deviceId;
		const _fftSize = fftSize;
		const _smoothingTimeConstant = smoothingTimeConstant;
		const _onError = onError;
		const _onStreamReady = onStreamReady;
		const _onStreamEnd = onStreamEnd;

		if (!_active) {
			if (streamRef) {
				streamRef.getTracks().forEach((track) => track.stop());
				streamRef = null;
				_onStreamEnd?.();
			}
			if (audioContextRef && audioContextRef.state !== "closed") {
				audioContextRef.close();
				audioContextRef = null;
			}
			if (animationRef !== null) {
				cancelAnimationFrame(animationRef);
				animationRef = null;
			}
			return;
		}

		let cancelled = false;

		const setupMicrophone = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: _deviceId
						? {
								deviceId: { exact: _deviceId },
								echoCancellation: true,
								noiseSuppression: true,
								autoGainControl: true,
							}
						: {
								echoCancellation: true,
								noiseSuppression: true,
								autoGainControl: true,
							},
				});
				if (cancelled) {
					stream.getTracks().forEach((track) => track.stop());
					return;
				}
				streamRef = stream;
				_onStreamReady?.(stream);

				const AudioContextCtor =
					window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
				const audioContext = new AudioContextCtor();
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = _fftSize;
				analyser.smoothingTimeConstant = _smoothingTimeConstant;

				const source = audioContext.createMediaStreamSource(stream);
				source.connect(analyser);

				audioContextRef = audioContext;
				analyserRef = analyser;

				// Clear history when starting.
				historyRef = [];
			} catch (error) {
				_onError?.(error as Error);
			}
		};

		setupMicrophone();

		return () => {
			cancelled = true;
			if (streamRef) {
				streamRef.getTracks().forEach((track) => track.stop());
				streamRef = null;
				_onStreamEnd?.();
			}
			if (audioContextRef && audioContextRef.state !== "closed") {
				audioContextRef.close();
				audioContextRef = null;
			}
			if (animationRef !== null) {
				cancelAnimationFrame(animationRef);
				animationRef = null;
			}
		};
	});

	// Effect 4: Main render RAF loop.
	$effect(() => {
		const canvas = canvasEl;
		if (!canvas) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const _active = active;
		const _processing = processing;
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
		const _mode = mode;
		// Reference processing so auto-tracking re-runs when it flips.
		void _processing;

		let rafId: number;

		const animate = (currentTime: number) => {
			const rect = canvas.getBoundingClientRect();

			// Update audio data if active.
			if (_active && currentTime - lastUpdateRef > _updateRate) {
				lastUpdateRef = currentTime;

				if (analyserRef) {
					const dataArray = new Uint8Array(analyserRef.frequencyBinCount);
					analyserRef.getByteFrequencyData(dataArray);

					if (_mode === "static") {
						// Static mode: symmetric frequency bands, fixed positions.
						const startFreq = Math.floor(dataArray.length * 0.05);
						const endFreq = Math.floor(dataArray.length * 0.4);
						const relevantData = dataArray.slice(startFreq, endFreq);

						const barCount = Math.floor(rect.width / (_barWidth + _barGap));
						const halfCount = Math.floor(barCount / 2);
						const newBars: number[] = [];

						// Mirror the data for symmetric display.
						for (let i = halfCount - 1; i >= 0; i--) {
							const dataIndex = Math.floor((i / halfCount) * relevantData.length);
							const value = Math.min(1, (relevantData[dataIndex] / 255) * _sensitivity);
							newBars.push(Math.max(0.05, value));
						}

						for (let i = 0; i < halfCount; i++) {
							const dataIndex = Math.floor((i / halfCount) * relevantData.length);
							const value = Math.min(1, (relevantData[dataIndex] / 255) * _sensitivity);
							newBars.push(Math.max(0.05, value));
						}

						staticBarsRef = newBars;
						lastActiveDataRef = newBars;
					} else {
						// Scrolling mode: running average, scrolls right-to-left.
						let sum = 0;
						const startFreq = Math.floor(dataArray.length * 0.05);
						const endFreq = Math.floor(dataArray.length * 0.4);
						const relevantData = dataArray.slice(startFreq, endFreq);

						for (let i = 0; i < relevantData.length; i++) {
							sum += relevantData[i];
						}
						const average = (sum / relevantData.length / 255) * _sensitivity;

						historyRef.push(Math.min(1, Math.max(0.05, average)));
						lastActiveDataRef = [...historyRef];

						if (historyRef.length > _historySize) {
							historyRef.shift();
						}
					}
					needsRedrawRef = true;
				}
			}

			// Skip redraw if nothing changed and we're idle.
			if (!needsRedrawRef && !_active) {
				rafId = requestAnimationFrame(animate);
				return;
			}

			needsRedrawRef = _active;
			ctx.clearRect(0, 0, rect.width, rect.height);

			const computedBarColor =
				_barColor ||
				(() => {
					const style = getComputedStyle(canvas);
					const color = style.color;
					return color || "#000";
				})();

			const step = _barWidth + _barGap;
			const barCount = Math.floor(rect.width / step);
			const centerY = rect.height / 2;

			if (_mode === "static") {
				// Static mode — bars in fixed positions.
				const dataToRender = staticBarsRef;

				for (let i = 0; i < barCount && i < dataToRender.length; i++) {
					const value = dataToRender[i] || 0.1;
					const x = i * step;
					const barHeightPx = Math.max(_baseBarHeight, value * rect.height * 0.8);
					const y = centerY - barHeightPx / 2;

					ctx.fillStyle = computedBarColor;
					ctx.globalAlpha = 0.4 + value * 0.6;

					if (_barRadius > 0) {
						ctx.beginPath();
						ctx.roundRect(x, y, _barWidth, barHeightPx, _barRadius);
						ctx.fill();
					} else {
						ctx.fillRect(x, y, _barWidth, barHeightPx);
					}
				}
			} else {
				// Scrolling mode — bars drawn right-to-left from history tail.
				for (let i = 0; i < barCount && i < historyRef.length; i++) {
					const dataIndex = historyRef.length - 1 - i;
					const value = historyRef[dataIndex] || 0.1;
					const x = rect.width - (i + 1) * step;
					const barHeightPx = Math.max(_baseBarHeight, value * rect.height * 0.8);
					const y = centerY - barHeightPx / 2;

					ctx.fillStyle = computedBarColor;
					ctx.globalAlpha = 0.4 + value * 0.6;

					if (_barRadius > 0) {
						ctx.beginPath();
						ctx.roundRect(x, y, _barWidth, barHeightPx, _barRadius);
						ctx.fill();
					} else {
						ctx.fillRect(x, y, _barWidth, barHeightPx);
					}
				}
			}

			// Apply edge fading via cached gradient + destination-out.
			if (_fadeEdges && _fadeWidth > 0 && rect.width > 0) {
				if (!gradientCacheRef || lastWidthRef !== rect.width) {
					const gradient = ctx.createLinearGradient(0, 0, rect.width, 0);
					const fadePercent = Math.min(0.3, _fadeWidth / rect.width);

					gradient.addColorStop(0, "rgba(255,255,255,1)");
					gradient.addColorStop(fadePercent, "rgba(255,255,255,0)");
					gradient.addColorStop(1 - fadePercent, "rgba(255,255,255,0)");
					gradient.addColorStop(1, "rgba(255,255,255,1)");

					gradientCacheRef = gradient;
					lastWidthRef = rect.width;
				}

				ctx.globalCompositeOperation = "destination-out";
				ctx.fillStyle = gradientCacheRef;
				ctx.fillRect(0, 0, rect.width, rect.height);
				ctx.globalCompositeOperation = "source-over";
			}

			ctx.globalAlpha = 1;

			rafId = requestAnimationFrame(animate);
		};

		rafId = requestAnimationFrame(animate);

		return () => {
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
		};
	});
</script>

<div
	bind:this={containerEl}
	{...restProps}
	data-slot="live-waveform"
	class={cn("relative h-full w-full", className)}
	style:height={heightStyle}
	aria-label={active
		? "Live audio waveform"
		: processing
			? "Processing audio"
			: "Audio waveform idle"}
	role="img"
>
	{#if !active && !processing}
		<div
			class="border-muted-foreground/20 absolute top-1/2 right-0 left-0 -translate-y-1/2 border-t-2 border-dotted"
		></div>
	{/if}
	<canvas bind:this={canvasEl} class="block h-full w-full" aria-hidden="true"></canvas>
</div>

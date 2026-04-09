import { getContext, setContext } from "svelte";
import { findWordIndex } from "./utils.js";
import type { TranscriptSegment, TranscriptWord } from "./utils.js";

export type TranscriptViewerWordStatus = "spoken" | "unspoken" | "current";

export type AudioType =
	| "audio/mpeg"
	| "audio/wav"
	| "audio/ogg"
	| "audio/mp3"
	| "audio/m4a"
	| "audio/aac"
	| "audio/webm";

const TRANSCRIPT_VIEWER_CONTEXT_KEY = Symbol("svagent-transcript-viewer");

/**
 * Reactive state shared between a `<TranscriptViewer>` root and its sub-components
 * via Svelte context. The root creates and registers the instance; sub-components
 * consume it via `useTranscriptViewer()`.
 *
 * The audio element is bound by `<TranscriptViewerAudio>` into `this.audio`;
 * the root's `$effect` observes that and wires up playback event listeners and
 * the `requestAnimationFrame` sync loop.
 */
export class TranscriptViewerState {
	audio: HTMLAudioElement | null = $state(null);
	audioSrc = $state("");
	audioType = $state<AudioType>("audio/mpeg");

	segments: TranscriptSegment[] = $state([]);
	words: TranscriptWord[] = $state([]);

	isPlaying = $state(false);
	isScrubbing = $state(false);
	duration = $state(0);
	currentTime = $state(0);
	currentWordIndex = $state(-1);

	currentWord = $derived(
		this.currentWordIndex >= 0 && this.currentWordIndex < this.words.length
			? this.words[this.currentWordIndex]
			: null
	);

	currentSegmentIndex = $derived(this.currentWord?.segmentIndex ?? -1);

	spokenSegments = $derived(
		this.segments.length && this.currentSegmentIndex > 0
			? this.segments.slice(0, this.currentSegmentIndex)
			: []
	);

	unspokenSegments: TranscriptSegment[] = $derived.by(() => {
		if (!this.segments.length) return [];
		if (this.currentSegmentIndex === -1) return this.segments;
		if (this.currentSegmentIndex + 1 >= this.segments.length) return [];
		return this.segments.slice(this.currentSegmentIndex + 1);
	});

	/**
	 * Updates `currentWordIndex` based on the new playback time. Mirrors the
	 * forward-walk optimization from React's use-transcript-viewer hook:
	 * cheap advancement for normal playback, binary-search fallback for seeks
	 * and edge cases.
	 */
	handleTimeUpdate = (time: number): void => {
		if (!this.words.length) return;

		const current =
			this.currentWordIndex >= 0 && this.currentWordIndex < this.words.length
				? this.words[this.currentWordIndex]
				: undefined;

		if (!current) {
			const found = findWordIndex(this.words, time);
			if (found !== -1) this.currentWordIndex = found;
			return;
		}

		let next = this.currentWordIndex;
		if (time >= current.endTime && this.currentWordIndex + 1 < this.words.length) {
			while (next + 1 < this.words.length && time >= this.words[next + 1].startTime) {
				next++;
			}
			// If we landed inside the next word's window, pick it. Otherwise snap to
			// the latest word that started at or before `time` (i.e. we're in a
			// timing gap with no word actively speaking).
			this.currentWordIndex = next;
			return;
		}

		if (time < current.startTime) {
			const found = findWordIndex(this.words, time);
			if (found !== -1) this.currentWordIndex = found;
			return;
		}

		const found = findWordIndex(this.words, time);
		if (found !== -1 && found !== this.currentWordIndex) {
			this.currentWordIndex = found;
		}
	};

	seekToTime = (time: number): void => {
		const node = this.audio;
		if (!node) return;
		// Optimistically update UI time immediately to reflect the seek, since
		// some browsers coalesce timeupdate/seeked events under rapid seeks.
		this.currentTime = time;
		node.currentTime = time;
		this.handleTimeUpdate(time);
	};

	seekToWord = (word: number | TranscriptWord): void => {
		const target = typeof word === "number" ? this.words[word] : word;
		if (!target) return;
		this.seekToTime(target.startTime);
	};

	play = (): void => {
		const audio = this.audio;
		if (!audio) return;
		if (audio.paused) {
			void audio.play().catch(() => {
				/* autoplay may be blocked; surface via audio error events */
			});
		}
	};

	pause = (): void => {
		const audio = this.audio;
		if (audio && !audio.paused) audio.pause();
	};

	startScrubbing = (): void => {
		this.isScrubbing = true;
	};

	endScrubbing = (): void => {
		this.isScrubbing = false;
	};
}

export function setTranscriptViewer(): TranscriptViewerState {
	const state = new TranscriptViewerState();
	setContext(TRANSCRIPT_VIEWER_CONTEXT_KEY, state);
	return state;
}

export function useTranscriptViewer(): TranscriptViewerState {
	const ctx = getContext<TranscriptViewerState | undefined>(TRANSCRIPT_VIEWER_CONTEXT_KEY);
	if (!ctx) {
		throw new Error("useTranscriptViewer must be called within a <TranscriptViewer>");
	}
	return ctx;
}

export type {
	CharacterAlignment,
	CharacterAlignmentResponseModel,
	TranscriptSegment,
	TranscriptWord,
	GapSegment,
	SegmentComposer,
	ComposeSegmentsOptions,
	ComposeSegmentsResult,
} from "./utils.js";

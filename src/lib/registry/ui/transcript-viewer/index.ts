import Root from "./transcript-viewer.svelte";
import Words from "./transcript-viewer-words.svelte";
import Word from "./transcript-viewer-word.svelte";
import Audio from "./transcript-viewer-audio.svelte";
import PlayPauseButton from "./transcript-viewer-play-pause-button.svelte";
import ScrubBar from "./transcript-viewer-scrub-bar.svelte";

export {
	Root,
	Words,
	Word,
	Audio,
	PlayPauseButton,
	ScrubBar,
	//
	Root as TranscriptViewer,
	Root as TranscriptViewerContainer,
	Words as TranscriptViewerWords,
	Word as TranscriptViewerWord,
	Audio as TranscriptViewerAudio,
	PlayPauseButton as TranscriptViewerPlayPauseButton,
	ScrubBar as TranscriptViewerScrubBar,
};

export {
	setTranscriptViewer,
	useTranscriptViewer,
	TranscriptViewerState,
} from "./context.svelte.js";

export type { TranscriptViewerProps } from "./transcript-viewer.svelte";
export type { TranscriptViewerWordsProps } from "./transcript-viewer-words.svelte";
export type { TranscriptViewerWordProps } from "./transcript-viewer-word.svelte";
export type { TranscriptViewerAudioProps } from "./transcript-viewer-audio.svelte";
export type { TranscriptViewerPlayPauseButtonProps } from "./transcript-viewer-play-pause-button.svelte";
export type { TranscriptViewerScrubBarProps } from "./transcript-viewer-scrub-bar.svelte";
export type { AudioType, TranscriptViewerWordStatus } from "./context.svelte.js";
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

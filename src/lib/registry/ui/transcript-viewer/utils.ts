/**
 * Character-level alignment data. Each index `i` in the three arrays corresponds
 * to a single character of the spoken transcript, with its start/end time in seconds.
 *
 * This shape matches ElevenLabs' `CharacterAlignmentResponseModel` exactly, so
 * ElevenLabs users can pass their API response directly. For other providers
 * (OpenAI, Deepgram, custom), reshape your data to this structure.
 */
export interface CharacterAlignment {
	characters: string[];
	characterStartTimesSeconds: number[];
	characterEndTimesSeconds: number[];
}

/** Alias for users importing from ElevenLabs conventions. */
export type CharacterAlignmentResponseModel = CharacterAlignment;

type BaseSegment = {
	segmentIndex: number;
	text: string;
};

export type TranscriptWord = BaseSegment & {
	kind: "word";
	wordIndex: number;
	startTime: number;
	endTime: number;
};

export type GapSegment = BaseSegment & {
	kind: "gap";
};

export type TranscriptSegment = TranscriptWord | GapSegment;

export type ComposeSegmentsOptions = {
	hideAudioTags?: boolean;
};

export type ComposeSegmentsResult = {
	segments: TranscriptSegment[];
	words: TranscriptWord[];
};

export type SegmentComposer = (alignment: CharacterAlignment) => ComposeSegmentsResult;

/**
 * Walks the character arrays and groups them into word segments (contiguous
 * non-whitespace runs) and gap segments (whitespace). If `hideAudioTags` is
 * true, any content inside `[...]` is stripped from the output entirely.
 */
export function composeSegments(
	alignment: CharacterAlignment,
	options: ComposeSegmentsOptions = {}
): ComposeSegmentsResult {
	const {
		characters,
		characterStartTimesSeconds: starts,
		characterEndTimesSeconds: ends,
	} = alignment;

	const segments: TranscriptSegment[] = [];
	const words: TranscriptWord[] = [];

	let wordBuffer = "";
	let whitespaceBuffer = "";
	let wordStart = 0;
	let wordEnd = 0;
	let segmentIndex = 0;
	let wordIndex = 0;
	let insideAudioTag = false;

	const hideAudioTags = options.hideAudioTags ?? false;

	const flushWhitespace = () => {
		if (!whitespaceBuffer) return;
		segments.push({
			kind: "gap",
			segmentIndex: segmentIndex++,
			text: whitespaceBuffer,
		});
		whitespaceBuffer = "";
	};

	const flushWord = () => {
		if (!wordBuffer) return;
		const word: TranscriptWord = {
			kind: "word",
			segmentIndex: segmentIndex++,
			wordIndex: wordIndex++,
			text: wordBuffer,
			startTime: wordStart,
			endTime: wordEnd,
		};
		segments.push(word);
		words.push(word);
		wordBuffer = "";
	};

	for (let i = 0; i < characters.length; i++) {
		const char = characters[i];
		const start = starts[i] ?? 0;
		const end = ends[i] ?? start;

		if (hideAudioTags) {
			if (char === "[") {
				flushWord();
				whitespaceBuffer = "";
				insideAudioTag = true;
				continue;
			}

			if (insideAudioTag) {
				if (char === "]") insideAudioTag = false;
				continue;
			}
		}

		if (/\s/.test(char)) {
			flushWord();
			whitespaceBuffer += char;
			continue;
		}

		if (whitespaceBuffer) {
			flushWhitespace();
		}

		if (!wordBuffer) {
			wordBuffer = char;
			wordStart = start;
			wordEnd = end;
		} else {
			wordBuffer += char;
			wordEnd = end;
		}
	}

	flushWord();
	flushWhitespace();

	return { segments, words };
}

/**
 * Binary search: finds the index of the word whose [startTime, endTime) window
 * contains `time`. Returns -1 if no word matches (e.g., `time` is in a timing gap
 * between words, or outside the transcript's bounds).
 */
export function findWordIndex(words: TranscriptWord[], time: number): number {
	if (!words.length) return -1;
	let lo = 0;
	let hi = words.length - 1;
	let answer = -1;
	while (lo <= hi) {
		const mid = Math.floor((lo + hi) / 2);
		const word = words[mid];
		if (time >= word.startTime && time < word.endTime) {
			answer = mid;
			break;
		}
		if (time < word.startTime) {
			hi = mid - 1;
		} else {
			lo = mid + 1;
		}
	}
	return answer;
}

/**
 * Best-effort duration guess from alignment data, used while audio metadata
 * is still loading. Returns the last character end time, or the last word end
 * time, or 0.
 */
export function guessedDurationFrom(
	alignment: CharacterAlignment,
	words: TranscriptWord[]
): number {
	const ends = alignment?.characterEndTimesSeconds;
	if (Array.isArray(ends) && ends.length) {
		const last = ends[ends.length - 1];
		return Number.isFinite(last) ? last : 0;
	}
	if (words.length) {
		const lastWord = words[words.length - 1];
		return Number.isFinite(lastWord.endTime) ? lastWord.endTime : 0;
	}
	return 0;
}

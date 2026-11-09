import type { Frame } from "$lib/registry/ui/matrix/index.js";
import { COLS, ROWS } from "./game-engine.js";

// Matrix title and result lettering from the pinned ElevenLabs UI reference.
const WORDS: Record<string, string[]> = {
	PONG: [
		"000000000000000000000",
		"000111011101110111100",
		"000101010101010100000",
		"000111010101010101100",
		"000100010101010100100",
		"000100011101010111100",
		"000000000000000000000",
	],
	WIN: [
		"000000000000000000000",
		"001010101110100010000",
		"001010100100110010000",
		"001010100100101010000",
		"001010100100100110000",
		"000101001110100010000",
		"000000000000000000000",
	],
	LOSE: [
		"000000000000000000000",
		"001000111011101111000",
		"001000101010001000000",
		"001000101011101110000",
		"001000101000101000000",
		"001110111011101111000",
		"000000000000000000000",
	],
};

/** Center the reference lettering in a board, cropping only when the board is smaller. */
export function renderWord(word: string, cols = COLS, rows = ROWS): Frame {
	const pattern = WORDS[word.toUpperCase()] ?? [];
	const top = Math.floor((rows - ROWS) / 2);
	const left = Math.floor((cols - COLS) / 2);
	return Array.from({ length: rows }, (_, row) =>
		Array.from({ length: cols }, (_, col) => Number(pattern[row - top]?.[col - left] ?? 0))
	);
}

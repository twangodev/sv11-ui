import type { Frame } from "$lib/registry/ui/matrix/index.js";
import { COLS, ROWS } from "./game-engine.js";

// 3×5 bitmap font, just the glyphs needed for PONG / WIN / LOSE.
const GLYPHS: Record<string, number[][]> = {
	P: [
		[1, 1, 1],
		[1, 0, 1],
		[1, 1, 1],
		[1, 0, 0],
		[1, 0, 0],
	],
	O: [
		[1, 1, 1],
		[1, 0, 1],
		[1, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
	],
	N: [
		[1, 0, 1],
		[1, 1, 1],
		[1, 1, 1],
		[1, 1, 1],
		[1, 0, 1],
	],
	G: [
		[1, 1, 1],
		[1, 0, 0],
		[1, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
	],
	W: [
		[1, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
		[1, 1, 1],
		[1, 0, 1],
	],
	I: [
		[1, 1, 1],
		[0, 1, 0],
		[0, 1, 0],
		[0, 1, 0],
		[1, 1, 1],
	],
	L: [
		[1, 0, 0],
		[1, 0, 0],
		[1, 0, 0],
		[1, 0, 0],
		[1, 1, 1],
	],
	S: [
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
	],
	E: [
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
	],
};

const GLYPH_W = 3;
const GLYPH_H = 5;

/** Render a short word centered in a ROWS×COLS frame using the bitmap font. */
export function renderWord(word: string, cols = COLS, rows = ROWS): Frame {
	const letters = word.toUpperCase().split("");
	const width = letters.length * GLYPH_W + (letters.length - 1);
	const startCol = Math.floor((cols - width) / 2);
	const startRow = Math.floor((rows - GLYPH_H) / 2);

	const frame: Frame = Array.from({ length: rows }, () => Array(cols).fill(0));
	let col = startCol;
	for (const letter of letters) {
		const glyph = GLYPHS[letter];
		if (glyph) {
			for (let r = 0; r < GLYPH_H; r++) {
				for (let c = 0; c < GLYPH_W; c++) {
					const row = startRow + r;
					const cc = col + c;
					if (row >= 0 && row < rows && cc >= 0 && cc < cols) frame[row][cc] = glyph[r][c];
				}
			}
		}
		col += GLYPH_W + 1;
	}
	return frame;
}

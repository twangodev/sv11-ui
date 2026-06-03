// Local-only win counter (no backend). The upstream block tracked a live player
// count via Redis; here we persist the player's wins in localStorage instead, so
// the block stays self-contained and provider-agnostic.

const KEY = "sv11-pong-01-wins";

export function getWins(): number {
	if (typeof localStorage === "undefined") return 0;
	try {
		const value = Number(localStorage.getItem(KEY));
		return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
	} catch {
		return 0; // storage unavailable (private mode, blocked) — treat as no wins
	}
}

export function recordWin(): number {
	const next = getWins() + 1;
	try {
		localStorage.setItem(KEY, String(next));
	} catch {
		/* storage unavailable (private mode, etc.) — ignore */
	}
	return next;
}

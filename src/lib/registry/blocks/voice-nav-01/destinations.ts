export type VoiceNavDestination = {
	label: string;
	/** URL to navigate the embedded frame to. Same-origin paths embed cleanly. */
	url: string;
	/** Lowercase phrases that should route here. Multi-word phrases score higher. */
	keywords: string[];
};

// Default demo destinations point at this site's own routes so they embed
// without cross-origin frame restrictions. Replace with your own.
export const DEFAULT_DESTINATIONS: VoiceNavDestination[] = [
	{ label: "Home", url: "/", keywords: ["home", "start", "introduction", "intro"] },
	{
		label: "Components",
		url: "/docs/components",
		keywords: ["components", "component", "browse"],
	},
	{ label: "Blocks", url: "/blocks", keywords: ["blocks", "examples", "gallery"] },
	{
		label: "Orb",
		url: "/docs/components/orb",
		keywords: ["orb", "sphere", "3d", "visualizer", "agent"],
	},
	{
		label: "Audio Player",
		url: "/docs/components/audio-player",
		keywords: ["audio player", "audio", "music", "playback"],
	},
	{
		label: "Theming",
		url: "/docs/theming",
		keywords: ["theme", "theming", "colors", "customize", "style"],
	},
	{
		label: "Setup",
		url: "/docs/setup",
		keywords: ["setup", "install", "installation", "getting started", "get started"],
	},
];

/**
 * Default intent resolver: scores each destination by keyword/label overlap and
 * returns the best match's URL, or `null` when nothing matches. Swap in an
 * LLM-backed resolver (e.g. structured output over your sitemap) via the
 * `resolve` prop for fuzzy, real-world navigation.
 */
export function matchDestination(
	transcript: string,
	destinations: VoiceNavDestination[]
): string | null {
	const text = transcript.toLowerCase();
	let best: VoiceNavDestination | null = null;
	let bestScore = 0;
	for (const dest of destinations) {
		let score = 0;
		if (text.includes(dest.label.toLowerCase())) score += 2;
		for (const keyword of dest.keywords) {
			if (text.includes(keyword)) score += keyword.includes(" ") ? 2 : 1;
		}
		if (score > bestScore) {
			bestScore = score;
			best = dest;
		}
	}
	return best && bestScore > 0 ? best.url : null;
}

export type Language = {
	/** BCP-47 tag passed to the recognizer, or `null` to use the browser default. */
	code: string | null;
	name: string;
};

export const LANGUAGES: Language[] = [
	{ code: null, name: "Auto-detect" },
	{ code: "en-US", name: "English (US)" },
	{ code: "en-GB", name: "English (UK)" },
	{ code: "es-ES", name: "Spanish" },
	{ code: "fr-FR", name: "French" },
	{ code: "de-DE", name: "German" },
	{ code: "it-IT", name: "Italian" },
	{ code: "pt-BR", name: "Portuguese (Brazil)" },
	{ code: "nl-NL", name: "Dutch" },
	{ code: "pl-PL", name: "Polish" },
	{ code: "ru-RU", name: "Russian" },
	{ code: "hi-IN", name: "Hindi" },
	{ code: "ja-JP", name: "Japanese" },
	{ code: "ko-KR", name: "Korean" },
	{ code: "zh-CN", name: "Chinese (Mandarin)" },
	{ code: "ar-SA", name: "Arabic" },
];

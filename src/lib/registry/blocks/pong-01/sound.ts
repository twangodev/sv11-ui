import type { PongSound } from "./game-engine.js";

type Tone = { freq: number; type: OscillatorType; duration: number };

const TONES: Record<PongSound, Tone> = {
	paddleHit: { freq: 440, type: "square", duration: 0.05 },
	wallHit: { freq: 220, type: "square", duration: 0.04 },
	score: { freq: 660, type: "sine", duration: 0.14 },
	gameStart: { freq: 523, type: "triangle", duration: 0.12 },
	win: { freq: 784, type: "sine", duration: 0.22 },
};

/**
 * Self-contained sound effects synthesized with the Web Audio API — no audio
 * files, no network. Construct lazily and call `resume()` from a user gesture
 * to satisfy autoplay policies.
 */
export class PongSounds {
	#ctx: AudioContext | null = null;
	enabled = true;

	#context(): AudioContext | null {
		if (typeof window === "undefined") return null;
		const Ctor =
			window.AudioContext ??
			(window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		this.#ctx ??= new Ctor();
		return this.#ctx;
	}

	resume() {
		void this.#context()?.resume();
	}

	play(sound: PongSound) {
		if (!this.enabled) return;
		const ctx = this.#context();
		if (!ctx) return;
		const tone = TONES[sound];
		const now = ctx.currentTime;

		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = tone.type;
		osc.frequency.setValueAtTime(tone.freq, now);
		if (sound === "score" || sound === "win") {
			osc.frequency.exponentialRampToValueAtTime(tone.freq * 1.5, now + tone.duration);
		}
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);

		osc.connect(gain).connect(ctx.destination);
		osc.start(now);
		osc.stop(now + tone.duration + 0.02);
	}
}

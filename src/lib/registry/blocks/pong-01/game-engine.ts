// Pure Pong physics — no framework, no DOM. The component drives it with a
// requestAnimationFrame loop and renders the state onto a Matrix display.

export const COLS = 21;
export const ROWS = 7;
export const PADDLE_HEIGHT = 3;
export const WIN_SCORE = 3;

const INITIAL_SPEED = 0.15;
const MAX_SPEED = 0.4;
const SPEED_INCREASE = 1.08;
const PLAYER_SPEED = 0.32;
const AI_REACTION_SPEED = 0.14;
const AI_PREDICTION_ERROR = 1.2;
const TRAIL_LENGTH = 4;

export type PongState = "title" | "countdown" | "playing" | "paused" | "gameOver";
export type PongSound = "paddleHit" | "wallHit" | "score" | "gameStart" | "win";

type Point = { x: number; y: number };

export class PongEngine {
	state: PongState = "title";
	ball = { x: 10, y: 3, velX: INITIAL_SPEED, velY: 0.05, trail: [] as Point[] };
	player = { y: 2, targetY: 2 };
	ai = { y: 2, targetY: 2 };
	playerScore = 0;
	aiScore = 0;
	winner: "player" | "ai" | null = null;

	#onSound?: (sound: PongSound) => void;

	constructor(onSound?: (sound: PongSound) => void) {
		this.#onSound = onSound;
		this.#centerPaddles();
	}

	#centerPaddles() {
		const mid = (ROWS - PADDLE_HEIGHT) / 2;
		this.player.y = mid;
		this.player.targetY = mid;
		this.ai.y = mid;
		this.ai.targetY = mid;
	}

	startGame() {
		this.playerScore = 0;
		this.aiScore = 0;
		this.winner = null;
		this.#centerPaddles();
		this.resetBall(Math.random() < 0.5);
		this.state = "playing";
		this.#onSound?.("gameStart");
	}

	togglePause() {
		if (this.state === "playing") this.state = "paused";
		else if (this.state === "paused") this.state = "playing";
	}

	resetBall(towardPlayer: boolean) {
		this.ball.x = (COLS - 1) / 2;
		this.ball.y = Math.random() * (ROWS - 2) + 1;
		this.ball.velX = (towardPlayer ? -1 : 1) * INITIAL_SPEED;
		this.ball.velY = (Math.random() - 0.5) * 0.12;
		this.ball.trail = [];
	}

	/** Advance the simulation. `dt` is seconds since the last frame. */
	update(dt: number, playerInput: number) {
		if (this.state !== "playing") return;
		const step = dt * 60; // velocities are tuned per 60fps frame

		// Player paddle follows input.
		this.player.y = clamp(
			this.player.y + playerInput * PLAYER_SPEED * step,
			0,
			ROWS - PADDLE_HEIGHT
		);

		// AI predicts where the ball will cross its column and eases toward it.
		if (this.ball.velX > 0) {
			const framesToReach = (COLS - 1 - this.ball.x) / Math.max(this.ball.velX, 0.001);
			const predicted = this.ball.y + this.ball.velY * framesToReach;
			const bounced = reflect(predicted, 0, ROWS - 1);
			this.ai.targetY = bounced - PADDLE_HEIGHT / 2 + (Math.random() - 0.5) * AI_PREDICTION_ERROR;
		}
		this.ai.targetY = clamp(this.ai.targetY, 0, ROWS - PADDLE_HEIGHT);
		this.ai.y += (this.ai.targetY - this.ai.y) * AI_REACTION_SPEED * step;
		this.ai.y = clamp(this.ai.y, 0, ROWS - PADDLE_HEIGHT);

		// Ball trail.
		this.ball.trail.unshift({ x: this.ball.x, y: this.ball.y });
		if (this.ball.trail.length > TRAIL_LENGTH) this.ball.trail.pop();

		// Ball motion.
		this.ball.x += this.ball.velX * step;
		this.ball.y += this.ball.velY * step;

		// Top / bottom walls.
		if (this.ball.y <= 0) {
			this.ball.y = 0;
			this.ball.velY = Math.abs(this.ball.velY);
			this.#onSound?.("wallHit");
		} else if (this.ball.y >= ROWS - 1) {
			this.ball.y = ROWS - 1;
			this.ball.velY = -Math.abs(this.ball.velY);
			this.#onSound?.("wallHit");
		}

		// Player paddle (column 0).
		if (this.ball.velX < 0 && this.ball.x <= 1) {
			if (this.#hits(this.player.y)) {
				this.ball.x = 1;
				this.#bounce(this.player.y, 1);
			}
		}
		// AI paddle (column COLS-1).
		if (this.ball.velX > 0 && this.ball.x >= COLS - 2) {
			if (this.#hits(this.ai.y)) {
				this.ball.x = COLS - 2;
				this.#bounce(this.ai.y, -1);
			}
		}

		// Scoring.
		if (this.ball.x < 0) this.#score("ai");
		else if (this.ball.x > COLS - 1) this.#score("player");
	}

	#hits(paddleY: number) {
		return this.ball.y >= paddleY - 0.5 && this.ball.y <= paddleY + PADDLE_HEIGHT - 0.5;
	}

	#bounce(paddleY: number, direction: 1 | -1) {
		const center = paddleY + PADDLE_HEIGHT / 2 - 0.5;
		const offset = (this.ball.y - center) / (PADDLE_HEIGHT / 2);
		const speed = Math.min(Math.abs(this.ball.velX) * SPEED_INCREASE, MAX_SPEED);
		this.ball.velX = direction * speed;
		this.ball.velY = clamp(this.ball.velY + offset * 0.12, -MAX_SPEED, MAX_SPEED);
		this.#onSound?.("paddleHit");
	}

	#score(scorer: "player" | "ai") {
		if (scorer === "player") this.playerScore++;
		else this.aiScore++;
		this.#onSound?.("score");

		if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
			this.winner = this.playerScore > this.aiScore ? "player" : "ai";
			this.state = "gameOver";
			this.#onSound?.("win");
			return;
		}
		this.resetBall(scorer === "ai");
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.max(min, Math.min(max, value));
}

/** Reflect a value into the [min, max] range as if bouncing off the edges. */
function reflect(value: number, min: number, max: number) {
	const span = max - min;
	if (span <= 0) return min;
	const range = span * 2;
	let t = (value - min) % range;
	if (t < 0) t += range;
	return min + (t <= span ? t : range - t);
}

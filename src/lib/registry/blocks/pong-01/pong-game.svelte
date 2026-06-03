<script lang="ts" module>
	export type PongGameProps = { class?: string };
</script>

<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card, CardContent } from "$lib/registry/ui/card/index.js";
	import { Matrix, digits, type Frame } from "$lib/registry/ui/matrix/index.js";
	import { PongEngine, COLS, ROWS, PADDLE_HEIGHT, type PongState } from "./game-engine.js";
	import { renderWord } from "./bitmaps.js";
	import { PongSounds } from "./sound.js";
	import { getWins, recordWin } from "./score-store.js";

	let { class: className }: PongGameProps = $props();

	const sounds = new PongSounds();
	const engine = new PongEngine((sound) => sounds.play(sound));

	let gameState = $state<PongState>("title");
	let playerScore = $state(0);
	let aiScore = $state(0);
	let wins = $state(0);
	let frame = $state<Frame>(renderWord("PONG"));

	let playerInput = 0;
	let raf = 0;
	let lastTime = 0;
	let winRecorded = false;
	let container: HTMLDivElement | null = null;

	const hint = $derived(
		{
			title: "Press Space or tap Start · ↑ ↓ to move",
			countdown: "Get ready…",
			playing: "↑ ↓ to move · P to pause",
			paused: "Paused · P to resume",
			gameOver:
				engine.winner === "player" ? "You win! Space to play again" : "CPU wins · Space to retry",
		}[gameState]
	);

	function buildFrame(): Frame {
		if (engine.state === "title") return renderWord("PONG");
		if (engine.state === "gameOver") return renderWord(engine.winner === "player" ? "WIN" : "LOSE");

		const f: Frame = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
		const set = (r: number, c: number, v: number) => {
			const rr = Math.round(r);
			const cc = Math.round(c);
			if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) f[rr][cc] = v;
		};

		const midCol = Math.floor(COLS / 2);
		for (let r = 0; r < ROWS; r += 2) f[r][midCol] = 0.2;

		const py = Math.round(engine.player.y);
		const ay = Math.round(engine.ai.y);
		for (let i = 0; i < PADDLE_HEIGHT; i++) {
			set(py + i, 0, 1);
			set(ay + i, COLS - 1, 1);
		}

		engine.ball.trail.forEach((p, i) => set(p.y, p.x, Math.max(0.15, 0.5 - i * 0.12)));
		set(engine.ball.y, engine.ball.x, 1);
		return f;
	}

	function sync() {
		gameState = engine.state;
		playerScore = engine.playerScore;
		aiScore = engine.aiScore;
		if (engine.state === "gameOver" && engine.winner === "player" && !winRecorded) {
			winRecorded = true;
			wins = recordWin();
		}
		frame = buildFrame();
	}

	function loop(now: number) {
		const dt = lastTime ? Math.min(0.1, (now - lastTime) / 1000) : 0;
		lastTime = now;
		if (engine.state === "playing") engine.update(dt, playerInput);
		sync();
		if (engine.state === "playing" || engine.state === "paused") {
			raf = requestAnimationFrame(loop);
		} else {
			raf = 0;
		}
	}

	function startGame() {
		sounds.resume();
		// Focus the board so the keyboard controls work straight away (handlers are
		// scoped to the container, not the window, to avoid hijacking page scroll).
		container?.focus();
		winRecorded = false;
		lastTime = 0;
		engine.startGame();
		sync();
		if (!raf) raf = requestAnimationFrame(loop);
	}

	function onKeydown(event: KeyboardEvent) {
		switch (event.key) {
			case "ArrowUp":
				event.preventDefault();
				playerInput = -1;
				break;
			case "ArrowDown":
				event.preventDefault();
				playerInput = 1;
				break;
			case " ":
				if (engine.state === "title" || engine.state === "gameOver") {
					event.preventDefault();
					startGame();
				}
				break;
			case "p":
			case "P":
				if (engine.state === "playing" || engine.state === "paused") {
					engine.togglePause();
					sync();
				}
				break;
		}
	}

	function onKeyup(event: KeyboardEvent) {
		if (event.key === "ArrowUp" || event.key === "ArrowDown") playerInput = 0;
	}

	// Attach key handling imperatively (rather than markup on:keydown) so the board
	// is a focus-scoped, keyboard-driven widget: it only consumes arrow/space keys
	// while focused, leaving page scrolling intact and avoiding window-wide key
	// trapping on docs pages.
	function focusableBoard(node: HTMLDivElement) {
		container = node;
		node.tabIndex = 0;
		node.addEventListener("keydown", onKeydown);
		node.addEventListener("keyup", onKeyup);
		return {
			destroy() {
				container = null;
				node.removeEventListener("keydown", onKeydown);
				node.removeEventListener("keyup", onKeyup);
			},
		};
	}

	onMount(() => {
		wins = getWins();
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		sounds.destroy();
	});

	const canStart = $derived(gameState === "title" || gameState === "gameOver");
</script>

<div
	use:focusableBoard
	role="application"
	aria-label="Pong game"
	class="focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-2"
>
	<Card class={cn("mx-auto w-full max-w-2xl", className)}>
		<CardContent class="flex flex-col items-center gap-5 py-6">
			<div class="flex w-full max-w-md items-center justify-between">
				<div class="flex flex-col items-center gap-1">
					<Matrix rows={7} cols={5} pattern={digits[playerScore]} size={9} gap={2} />
					<span class="text-muted-foreground text-[10px] tracking-widest">YOU</span>
				</div>
				<span class="text-muted-foreground font-mono text-xs tracking-widest">
					WINS {wins.toString().padStart(3, "0")}
				</span>
				<div class="flex flex-col items-center gap-1">
					<Matrix rows={7} cols={5} pattern={digits[aiScore]} size={9} gap={2} />
					<span class="text-muted-foreground text-[10px] tracking-widest">CPU</span>
				</div>
			</div>

			<Matrix
				rows={ROWS}
				cols={COLS}
				pattern={frame}
				size={16}
				gap={3}
				class="text-foreground"
				aria-label="Pong game board"
			/>

			<div class="flex flex-col items-center gap-3">
				<p class="text-muted-foreground h-4 text-center text-xs">{hint}</p>
				{#if canStart}
					<Button size="sm" onclick={startGame}>
						{gameState === "title" ? "Start" : "Play again"}
					</Button>
				{/if}
			</div>
		</CardContent>
	</Card>
</div>

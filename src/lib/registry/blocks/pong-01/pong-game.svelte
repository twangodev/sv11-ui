<script lang="ts" module>
	export type PongGameProps = {
		class?: string;
		/** Return active-player count; called immediately and every five seconds. */
		heartbeat?: (playerId: string, signal: AbortSignal) => Promise<number>;
		onPresenceError?: (error: Error) => void;
	};
</script>

<script lang="ts">
	import { onMount, onDestroy } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Matrix, digits, type Frame } from "$lib/registry/ui/matrix/index.js";
	import { PongEngine, COLS, ROWS, PADDLE_HEIGHT, type PongState } from "./game-engine.js";
	import { renderWord } from "./bitmaps.js";
	import { PongSounds } from "./sound.js";
	import { getWins, recordWin } from "./score-store.js";

	let { class: className, heartbeat, onPresenceError }: PongGameProps = $props();

	const sounds = new PongSounds();
	const engine = new PongEngine((sound) => sounds.play(sound));

	let gameState = $state<PongState>("title");
	let playerScore = $state(0);
	let aiScore = $state(0);
	let wins = $state(0);
	let activePlayers = $state<number | null>(null);
	let frame = $state<Frame>(renderWord("PONG"));

	let playerInput = 0;
	let raf = 0;
	let lastTime = 0;
	let winRecorded = false;
	let container: HTMLDivElement | null = null;

	let boardWidth = $state(640);
	const scale = $derived(Math.min(1, Math.max(0.1, boardWidth / 596)));
	const countDigits = $derived(
		(activePlayers ?? wins)
			.toString()
			.padStart(activePlayers === null ? 3 : 4, "0")
			.split("")
			.map(Number)
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
		if (event.target instanceof Element && event.target.closest("button")) return;
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
		const observer = new ResizeObserver(([entry]) => {
			boardWidth = entry.contentRect.width;
		});
		observer.observe(node);
		node.tabIndex = 0;
		node.addEventListener("keydown", onKeydown);
		node.addEventListener("keyup", onKeyup);
		return {
			destroy() {
				observer.disconnect();
				container = null;
				node.removeEventListener("keydown", onKeydown);
				node.removeEventListener("keyup", onKeyup);
			},
		};
	}

	onMount(() => {
		wins = getWins();
	});
	$effect(() => {
		const ping = heartbeat;
		if (!ping) return;
		const controller = new AbortController(),
			playerId = crypto.randomUUID();
		let busy = false;
		const update = async () => {
			if (busy) return;
			busy = true;
			try {
				const count = await ping(playerId, controller.signal);
				if (!controller.signal.aborted) activePlayers = Math.max(0, Math.floor(count));
			} catch (cause) {
				if (!controller.signal.aborted)
					onPresenceError?.(cause instanceof Error ? cause : new Error(String(cause)));
			} finally {
				busy = false;
			}
		};
		void update();
		const interval = setInterval(update, 5000);
		return () => {
			controller.abort();
			clearInterval(interval);
		};
	});

	onDestroy(() => {
		if (raf) cancelAnimationFrame(raf);
		sounds.destroy();
	});

	const canStart = $derived(gameState === "title" || gameState === "gameOver");
</script>

<div
	use:focusableBoard
	role="group"
	aria-label="Pong game"
	data-slot="pong-01"
	class={cn(
		"focus-visible:ring-ring/50 flex min-h-[600px] w-full flex-col items-center justify-center gap-8 rounded-xl p-4 outline-none focus-visible:ring-2 sm:p-8",
		className
	)}
>
	<div class="flex max-w-full flex-col items-center gap-2">
		<div
			class="flex items-center gap-1.5"
			aria-label={activePlayers === null ? `${wins} wins` : `${activePlayers} playing`}
		>
			{#if activePlayers !== null}<Matrix
					rows={1}
					cols={1}
					pattern={[[1]]}
					size={4}
					gap={0}
					class="animate-pulse"
					ariaLabel="Live indicator"
				/>{/if}
			<div class="flex items-center gap-0.5">
				{#each countDigits as digit, index (index)}<Matrix
						rows={7}
						cols={5}
						pattern={digits[digit]}
						size={3}
						gap={0.5}
						ariaLabel={`Count digit ${digit}`}
					/>{/each}
				<span class="text-muted-foreground ml-1 font-mono text-[8px] tracking-wider uppercase"
					>{activePlayers === null ? "wins" : "playing"}</span
				>
			</div>
		</div>
		<div class="flex items-center" style:gap={`${32 * scale}px`}>
			<div class="flex flex-col items-center gap-2">
				<div class="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">
					Player
				</div>
				<Matrix
					rows={7}
					cols={5}
					pattern={digits[playerScore] || digits[0]}
					size={12 * scale}
					gap={2 * scale}
					ariaLabel="Player score"
				/>
			</div>
			<Matrix
				rows={ROWS}
				cols={COLS}
				pattern={frame}
				size={16 * scale}
				gap={3 * scale}
				ariaLabel="Pong game field"
			/>
			<div class="flex flex-col items-center gap-2">
				<div class="text-muted-foreground font-mono text-[9px] tracking-wider uppercase">CPU</div>
				<Matrix
					rows={7}
					cols={5}
					pattern={digits[aiScore] || digits[0]}
					size={12 * scale}
					gap={2 * scale}
					ariaLabel="CPU score"
				/>
			</div>
		</div>
		<div class="flex h-7 flex-col items-center justify-center gap-2">
			{#if canStart}
				<Button
					variant="ghost"
					size="sm"
					class="text-muted-foreground h-7 gap-1 p-0 text-xs font-normal hover:bg-transparent"
					onclick={startGame}
					aria-label={gameState === "title" ? "Start game" : "Play again"}
				>
					Press <kbd class="bg-muted rounded px-2 py-1">Space</kbd> to {gameState === "title"
						? "start"
						: "play again"}
				</Button>
			{:else if gameState === "playing"}
				<div class="text-muted-foreground text-center text-xs">
					<kbd class="bg-muted rounded px-2 py-1">↑</kbd><kbd
						class="bg-muted mx-1 rounded px-2 py-1">↓</kbd
					>
					Move &nbsp;·&nbsp; <kbd class="bg-muted rounded px-2 py-1">P</kbd> Pause
				</div>
			{:else if gameState === "paused"}
				<div class="text-muted-foreground text-center text-xs">
					PAUSED - Press <kbd class="bg-muted rounded px-2 py-1">P</kbd> to resume
				</div>
			{:else}<p class="text-muted-foreground text-xs">Get ready…</p>{/if}
		</div>
	</div>
</div>

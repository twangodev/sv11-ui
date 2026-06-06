<script lang="ts" module>
	import { tv } from "tailwind-variants";
	import type { TranscriptionAdapter } from "./adapter.js";

	export const realtimeTranscriber01Variants = tv({
		slots: {
			root: "bg-card relative flex min-h-[420px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border p-6",
			glow: "from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent",
			panel: "z-10 flex max-w-sm flex-col items-center gap-5 text-center",
			heading: "space-y-1.5",
			title: "text-2xl font-semibold tracking-tight",
			subtitle: "text-muted-foreground text-sm",
			kbd: "bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]",
			langButton: "gap-2",
			chevron: "text-muted-foreground size-3.5",
			popover: "w-56 p-0",
			startButton: "gap-2",
			errorText: "text-destructive text-sm",
			note: "text-muted-foreground max-w-xs text-xs",
			code: "bg-muted rounded px-1 py-0.5",
			badge: "text-muted-foreground font-normal",
			shimmer: "z-10 text-lg",
			transcript: "relative z-10 flex h-full max-h-[340px] w-full max-w-2xl flex-col",
			scroll: "flex-1",
			viewport: "max-h-[300px] overflow-y-auto px-2 py-1",
			transcriptText: "text-xl leading-relaxed",
			partialText: "text-foreground/40",
			copyRow: "flex justify-end pt-2",
			copyButton: "size-7",
			stopWrap: "absolute bottom-6 left-1/2 z-10 -translate-x-1/2",
			stopButton: "gap-2 shadow-sm",
			stopKbd: "bg-background/60 rounded px-1.5 py-0.5 font-mono text-[10px]",
		},
	});

	export type RealtimeTranscriber01Props = {
		/**
		 * Streaming transcription backend. Defaults to a browser Web Speech API
		 * adapter so the demo runs with no server (Chromium only). When provided,
		 * the language selector is hidden — your adapter owns language handling.
		 */
		adapter?: TranscriptionAdapter;
		class?: string;
	};
</script>

<script lang="ts">
	import GlobeIcon from "@lucide/svelte/icons/globe";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";
	import MicIcon from "@lucide/svelte/icons/mic";
	import SquareIcon from "@lucide/svelte/icons/square";
	import { onDestroy, onMount } from "svelte";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Badge } from "$lib/registry/ui/badge/index.js";
	import { ScrollArea } from "$lib/registry/ui/scroll-area/index.js";
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text/index.js";
	import * as Command from "$lib/registry/ui/command/index.js";
	import * as Popover from "$lib/registry/ui/popover/index.js";
	import { createWebSpeechAdapter, isSpeechRecognitionSupported } from "./adapter.js";
	import { LANGUAGES } from "./languages.js";

	let { adapter, class: className }: RealtimeTranscriber01Props = $props();

	const ui = realtimeTranscriber01Variants();

	type ConnectionState = "idle" | "connecting" | "connected" | "error";

	let connectionState = $state<ConnectionState>("idle");
	let committed = $state("");
	let partial = $state("");
	let error = $state("");
	let copied = $state(false);

	let selectedCode = $state<string | null>(null);
	let langOpen = $state(false);
	let scrollViewport = $state<HTMLElement | null>(null);

	let session: TranscriptionAdapter | null = null;

	// Optimistic until mounted so prerendered HTML doesn't flash the "unsupported"
	// note before the client can feature-detect.
	let mounted = $state(false);
	onMount(() => (mounted = true));
	const usingDemo = $derived(!adapter);
	const supported = $derived(!mounted || !usingDemo || isSpeechRecognitionSupported());
	const selectedName = $derived(
		LANGUAGES.find((l) => l.code === selectedCode)?.name ?? "Auto-detect"
	);
	const isActive = $derived(connectionState === "connecting" || connectionState === "connected");
	const isEmpty = $derived(!committed && !partial);
	const transcript = $derived((committed + (partial ? " " + partial : "")).trim());

	// Auto-scroll the transcript to the bottom as new text streams in.
	$effect(() => {
		void committed;
		void partial;
		if (scrollViewport) scrollViewport.scrollTop = scrollViewport.scrollHeight;
	});

	async function start() {
		error = "";
		committed = "";
		partial = "";
		connectionState = "connecting";
		session = adapter ?? createWebSpeechAdapter(selectedCode ?? navigator.language ?? "en-US");
		try {
			await session.start({
				onConnect: () => {
					if (connectionState === "connecting") connectionState = "connected";
				},
				onPartialTranscript: (text) => (partial = text),
				onCommittedTranscript: (text) => {
					if (text) committed = (committed ? committed + " " + text : text).trim();
					partial = "";
				},
				onDisconnect: () => {
					if (connectionState !== "error") connectionState = "idle";
				},
				onError: (err) => {
					error = err.message;
					connectionState = "error";
					session?.cancel();
					session = null;
				},
			});
		} catch (err) {
			error = err instanceof Error ? err.message : "Could not start transcription.";
			connectionState = "error";
			session = null;
		}
	}

	function stop() {
		session?.stop();
		session = null;
		connectionState = "idle";
		partial = "";
	}

	function toggle() {
		if (!supported) return;
		if (isActive) stop();
		else void start();
	}

	function onKeydown(event: KeyboardEvent) {
		// ⌘K / Ctrl+K toggles, except while typing in a field (e.g. the search box).
		const target = event.target as HTMLElement | null;
		if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable)
			return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			toggle();
		}
	}

	async function copy() {
		if (!transcript) return;
		try {
			await navigator.clipboard.writeText(transcript);
		} catch {
			return; // clipboard blocked (insecure context / denied) — leave UI untouched
		}
		copied = true;
		setTimeout(() => (copied = false), 1500);
	}

	function selectLanguage(code: string | null) {
		selectedCode = code;
		langOpen = false;
	}

	onDestroy(() => session?.cancel());
</script>

<svelte:window onkeydown={onKeydown} />

<div class={cn(ui.root(), className)}>
	{#if isActive}
		<div class={ui.glow()} aria-hidden="true"></div>
	{/if}

	{#if connectionState === "idle" || connectionState === "error"}
		<div class={ui.panel()}>
			<div class={ui.heading()}>
				<h2 class={ui.title()}>Realtime Speech to Text</h2>
				<p class={ui.subtitle()}>
					Transcribe your voice live as you speak. Press the button or
					<kbd class={ui.kbd()}>⌘K</kbd> to start.
				</p>
			</div>

			{#if usingDemo}
				<Popover.Root bind:open={langOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm" class={ui.langButton()}>
								<GlobeIcon class="size-3.5" />
								{selectedName}
								<ChevronDownIcon class={ui.chevron()} />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class={ui.popover()} align="center">
						<Command.Root>
							<Command.Input placeholder="Search language..." />
							<Command.List>
								<Command.Empty>No language found.</Command.Empty>
								<Command.Group>
									{#each LANGUAGES as language (language.code ?? "auto")}
										<Command.Item
											value={`${language.name} ${language.code ?? "auto"}`}
											onSelect={() => selectLanguage(language.code)}
										>
											<CheckIcon
												class={cn(
													"size-4",
													selectedCode === language.code ? "opacity-100" : "opacity-0"
												)}
											/>
											{language.name}
										</Command.Item>
									{/each}
								</Command.Group>
							</Command.List>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			{/if}

			<Button size="lg" onclick={toggle} disabled={!supported} class={ui.startButton()}>
				<MicIcon class="size-4" />
				Start Transcribing
			</Button>

			{#if connectionState === "error"}
				<p class={ui.errorText()}>{error}</p>
			{/if}

			{#if !supported}
				<p class={ui.note()}>
					This demo uses the browser Web Speech API (Chromium-based browsers). Pass an
					<code class={ui.code()}>adapter</code> to wire any provider.
				</p>
			{:else}
				<Badge variant="secondary" class={ui.badge()}>
					{usingDemo ? "Powered by the Web Speech API" : "Streaming speech to text"}
				</Badge>
			{/if}
		</div>
	{:else if connectionState === "connecting"}
		<ShimmeringText text="Connecting..." class={ui.shimmer()} />
	{:else if isEmpty}
		<ShimmeringText text="Say something aloud..." class={ui.shimmer()} />
	{:else}
		<div class={ui.transcript()}>
			<ScrollArea class={ui.scroll()}>
				<div bind:this={scrollViewport} class={ui.viewport()}>
					<p class={ui.transcriptText()}>
						<span>{committed}</span>
						{#if partial}
							<span class={ui.partialText()}>{committed ? " " : ""}{partial}</span>
						{/if}
					</p>
				</div>
			</ScrollArea>
			<div class={ui.copyRow()}>
				<Button
					variant="ghost"
					size="icon"
					class={ui.copyButton()}
					onclick={copy}
					aria-label="Copy transcript"
				>
					{#if copied}<CheckIcon class="size-3.5" />{:else}<CopyIcon class="size-3.5" />{/if}
				</Button>
			</div>
		</div>
	{/if}

	{#if connectionState === "connected"}
		<div class={ui.stopWrap()}>
			<Button variant="secondary" size="sm" onclick={toggle} class={ui.stopButton()}>
				<SquareIcon class="size-3.5" />
				Stop
				<kbd class={ui.stopKbd()}>⌘K</kbd>
			</Button>
		</div>
	{/if}
</div>

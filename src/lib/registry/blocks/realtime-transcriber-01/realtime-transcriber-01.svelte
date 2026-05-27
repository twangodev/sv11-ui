<script lang="ts" module>
	import type { TranscriptionAdapter } from "./adapter.js";

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
	import { onDestroy } from "svelte";
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

	const usingDemo = $derived(!adapter);
	const supported = $derived(!usingDemo || isSpeechRecognitionSupported());
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
					committed = text;
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
		if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
		if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
			event.preventDefault();
			toggle();
		}
	}

	async function copy() {
		if (!transcript) return;
		await navigator.clipboard.writeText(transcript);
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

<div
	class={cn(
		"bg-card relative flex min-h-[420px] w-full flex-col items-center justify-center overflow-hidden rounded-xl border p-6",
		className
	)}
>
	{#if isActive}
		<div
			class="from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent"
			aria-hidden="true"
		></div>
	{/if}

	{#if connectionState === "idle" || connectionState === "error"}
		<div class="z-10 flex max-w-sm flex-col items-center gap-5 text-center">
			<div class="space-y-1.5">
				<h2 class="text-2xl font-semibold tracking-tight">Realtime Speech to Text</h2>
				<p class="text-muted-foreground text-sm">
					Transcribe your voice live as you speak. Press the button or
					<kbd class="bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd> to start.
				</p>
			</div>

			{#if usingDemo}
				<Popover.Root bind:open={langOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button {...props} variant="outline" size="sm" class="gap-2">
								<GlobeIcon class="size-3.5" />
								{selectedName}
								<ChevronDownIcon class="text-muted-foreground size-3.5" />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="w-56 p-0" align="center">
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

			<Button size="lg" onclick={toggle} disabled={!supported} class="gap-2">
				<MicIcon class="size-4" />
				Start Transcribing
			</Button>

			{#if connectionState === "error"}
				<p class="text-destructive text-sm">{error}</p>
			{/if}

			{#if !supported}
				<p class="text-muted-foreground max-w-xs text-xs">
					This demo uses the browser Web Speech API (Chromium-based browsers). Pass an
					<code class="bg-muted rounded px-1 py-0.5">adapter</code> to wire any provider.
				</p>
			{:else}
				<Badge variant="secondary" class="text-muted-foreground font-normal">
					{usingDemo ? "Powered by the Web Speech API" : "Streaming speech to text"}
				</Badge>
			{/if}
		</div>
	{:else if connectionState === "connecting"}
		<ShimmeringText text="Connecting..." class="z-10 text-lg" />
	{:else if isEmpty}
		<ShimmeringText text="Say something aloud..." class="z-10 text-lg" />
	{:else}
		<div class="relative z-10 flex h-full max-h-[340px] w-full max-w-2xl flex-col">
			<ScrollArea class="flex-1">
				<div bind:this={scrollViewport} class="max-h-[300px] overflow-y-auto px-2 py-1">
					<p class="text-xl leading-relaxed">
						<span>{committed}</span>
						{#if partial}
							<span class="text-foreground/40">{committed ? " " : ""}{partial}</span>
						{/if}
					</p>
				</div>
			</ScrollArea>
			<div class="flex justify-end pt-2">
				<Button
					variant="ghost"
					size="icon"
					class="size-7"
					onclick={copy}
					aria-label="Copy transcript"
				>
					{#if copied}<CheckIcon class="size-3.5" />{:else}<CopyIcon class="size-3.5" />{/if}
				</Button>
			</div>
		</div>
	{/if}

	{#if connectionState === "connected"}
		<div class="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
			<Button variant="secondary" size="sm" onclick={toggle} class="gap-2 shadow-sm">
				<SquareIcon class="size-3.5" />
				Stop
				<kbd class="bg-background/60 rounded px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
			</Button>
		</div>
	{/if}
</div>

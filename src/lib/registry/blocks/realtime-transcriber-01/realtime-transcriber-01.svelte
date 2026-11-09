<script lang="ts" module>
	import { tv } from "tailwind-variants";
	import type { TranscriptionAdapter } from "./adapter.js";

	export const realtimeTranscriber01Variants = tv({
		slots: {
			root: "relative mx-auto flex h-full w-full max-w-4xl flex-col items-center justify-center",
			glow: "from-primary/5 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent",
			panel: "absolute inset-0 z-10 flex items-center justify-center",
			heading: "flex flex-col items-center gap-2 text-center",
			title: "text-2xl font-semibold tracking-tight",
			subtitle: "text-muted-foreground text-sm",
			kbd: "bg-muted rounded px-1.5 py-0.5 font-mono text-[10px]",
			langButton: "w-full justify-start gap-2",
			chevron: "text-muted-foreground ml-auto size-4",
			popover: "w-[var(--bits-popover-anchor-width)] p-0",
			startButton: "bg-foreground/95 hover:bg-foreground/90 w-full justify-center gap-3",
			errorText: "text-destructive text-sm",
			note: "text-muted-foreground max-w-xs text-xs",
			code: "bg-muted rounded px-1 py-0.5",
			badge: "text-foreground/60 h-auto rounded-md font-medium",
			shimmer: "z-10 text-3xl font-light tracking-wide",
			transcript: "absolute inset-0 z-10 flex flex-col",
			scroll: "flex-1",
			viewport: "max-h-[350px] overflow-y-auto px-12 py-8",
			transcriptText: "text-foreground/90 w-full text-xl leading-relaxed font-light",
			partialText: "text-foreground/40",
			copyRow: "absolute top-4 right-4",
			copyButton: "size-8 opacity-50 transition-opacity hover:opacity-100",
			stopWrap: "fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2",
			stopButton:
				"bg-foreground text-background border-foreground/10 gap-2 rounded-lg border px-3 py-2 shadow-lg transition-opacity hover:opacity-90",
			stopKbd:
				"border-background/20 bg-background/10 inline-flex h-5 items-center rounded border px-1.5 font-mono text-xs",
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
	import BackgroundAura from "./background-aura.svelte";

	let { adapter, class: className }: RealtimeTranscriber01Props = $props();

	const ui = realtimeTranscriber01Variants();

	type ConnectionState = "idle" | "connecting" | "connected" | "stopping" | "error";

	let connectionState = $state<ConnectionState>("idle");
	let committed = $state("");
	let partial = $state("");
	let error = $state("");
	let copied = $state(false);

	let selectedCode = $state<string | null>(null);
	let langOpen = $state(false);
	let scrollViewport = $state<HTMLElement | null>(null);

	let session: TranscriptionAdapter | null = null;
	let requestId = 0;

	// Optimistic until mounted so prerendered HTML doesn't flash the "unsupported"
	// note before the client can feature-detect.
	let mounted = $state(false);
	let shortcut = $state("Ctrl+K");
	onMount(() => {
		mounted = true;
		shortcut = /(Mac|iPhone|iPod|iPad)/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K";
	});
	const usingDemo = $derived(!adapter);
	const supported = $derived(!mounted || !usingDemo || isSpeechRecognitionSupported());
	const selectedName = $derived(
		LANGUAGES.find((l) => l.code === selectedCode)?.name ?? "Auto-detect"
	);
	const isActive = $derived(
		connectionState === "connecting" ||
			connectionState === "connected" ||
			connectionState === "stopping"
	);
	const isEmpty = $derived(!committed && !partial);
	const transcript = $derived((committed + (partial ? " " + partial : "")).trim());

	// Auto-scroll the transcript to the bottom as new text streams in.
	$effect(() => {
		void committed;
		void partial;
		if (scrollViewport) scrollViewport.scrollTop = scrollViewport.scrollHeight;
	});

	async function start() {
		const id = ++requestId;
		error = "";
		committed = "";
		partial = "";
		connectionState = "connecting";
		session = adapter ?? createWebSpeechAdapter(selectedCode ?? navigator.language ?? "en-US");
		try {
			await session.start({
				onConnect: () => {
					if (id === requestId && connectionState === "connecting") connectionState = "connected";
				},
				onPartialTranscript: (text) => {
					if (id === requestId) partial = text;
				},
				onCommittedTranscript: (text) => {
					if (id !== requestId) return;
					if (text) committed = (committed ? committed + " " + text : text).trim();
					partial = "";
				},
				onDisconnect: () => {
					if (id === requestId && connectionState !== "error" && connectionState !== "stopping")
						connectionState = "idle";
				},
				onError: (err) => {
					if (id !== requestId) return;
					error = err.message;
					connectionState = "error";
					void session?.cancel();
					session = null;
				},
			});
			if (id === requestId && connectionState === "connecting") connectionState = "connected";
		} catch (err) {
			if (id !== requestId) return;
			error = err instanceof Error ? err.message : "Could not start transcription.";
			connectionState = "error";
			session = null;
		}
	}

	async function stop() {
		const id = requestId,
			current = session;
		connectionState = "stopping";
		try {
			await current?.stop();
			if (id !== requestId) return;
			if (partial.trim()) committed = (committed + " " + partial).trim();
			partial = "";
			connectionState = "idle";
		} catch (cause) {
			if (id === requestId) {
				error = cause instanceof Error ? cause.message : "Could not finish transcription.";
				connectionState = "error";
			}
		} finally {
			if (id === requestId) {
				++requestId;
				session = null;
			}
		}
	}

	function toggle() {
		if (!supported || connectionState === "stopping") return;
		if (isActive) void stop();
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

	onDestroy(() => {
		++requestId;
		void session?.cancel();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div data-slot="realtime-transcriber-01" class={cn(ui.root(), className)}>
	<BackgroundAura active={isActive} connected={connectionState === "connected"} />
	<div
		class="relative flex h-full w-full flex-col items-center justify-center gap-8 overflow-hidden px-8 py-12"
	>
		<div
			class="relative flex min-h-[350px] w-full flex-1 items-center justify-center overflow-hidden"
		>
			{#if (connectionState === "idle" && isEmpty) || connectionState === "error"}
				<div class={ui.panel()}>
					<div class="flex w-full max-w-sm flex-col gap-4 px-8">
						<div class="flex flex-col items-center gap-6">
							<div class={ui.heading()}>
								<h2 class={ui.title()}>Realtime Speech to Text</h2>
								<p class={ui.subtitle()}>Transcribe your voice in real-time with high accuracy</p>
							</div>

							{#if usingDemo}
								<div class="w-full space-y-2">
									<label for="transcription-language" class="text-foreground/70 text-sm font-medium"
										>Language</label
									>
									<Popover.Root bind:open={langOpen}>
										<Popover.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													id="transcription-language"
													variant="outline"
													class={ui.langButton()}
												>
													<GlobeIcon class="size-4" />
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
								</div>
							{/if}

							<Button size="lg" onclick={toggle} disabled={!supported} class={ui.startButton()}>
								<span>Start Transcribing</span>
								<kbd
									class="border-background/20 bg-background/10 hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-xs sm:inline-flex"
									>{shortcut}</kbd
								>
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
								<Badge variant="outline" class={ui.badge()}>
									{usingDemo ? "Powered by the Web Speech API" : "Streaming speech to text"}
								</Badge>
							{/if}
						</div>
					</div>
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
		</div>
		{#if connectionState === "idle" && !isEmpty}
			<div class={ui.stopWrap()}><Button onclick={toggle}>Start Transcribing</Button></div>
		{:else if connectionState === "connected"}
			<div class={ui.stopWrap()}>
				<Button variant="secondary" size="sm" onclick={toggle} class={ui.stopButton()}>
					Stop
					<kbd class={ui.stopKbd()}>{shortcut}</kbd>
				</Button>
			</div>
		{/if}
	</div>
</div>

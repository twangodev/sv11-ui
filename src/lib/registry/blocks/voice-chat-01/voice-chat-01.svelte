<script lang="ts">
	import AudioLinesIcon from "@lucide/svelte/icons/audio-lines";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import PhoneOffIcon from "@lucide/svelte/icons/phone-off";
	import SendIcon from "@lucide/svelte/icons/send";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card, CardContent, CardFooter, CardHeader } from "$lib/registry/ui/card/index.js";
	import {
		Conversation,
		ConversationContent,
		ConversationEmptyState,
		ConversationScrollButton,
	} from "$lib/registry/ui/conversation/index.js";
	import { Input } from "$lib/registry/ui/input/index.js";
	import { Message, MessageContent } from "$lib/registry/ui/message/index.js";
	import { Orb } from "$lib/registry/ui/orb/index.js";
	import { Response } from "$lib/registry/ui/response/index.js";
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text/index.js";
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from "$lib/registry/ui/tooltip/index.js";
	import { cn } from "$lib/utils.js";

	let { class: className }: { class?: string } = $props();

	type ChatMessage = {
		role: "user" | "assistant";
		content: string;
	};

	type AgentState = "disconnected" | "connecting" | "connected" | "disconnecting" | null;

	const DEFAULT_AGENT = {
		name: "Customer Support",
		description: "AI Voice Assistant",
	};

	const CANNED_REPLIES = [
		"Thanks for reaching out — I can help with that. Can you share your order number?",
		"Got it. Let me pull that up for you.",
		"I just checked — your order is on track to ship within the next 1-2 business days.",
		"Anything else I can help with?",
	];

	let messages = $state<ChatMessage[]>([]);
	let agentState = $state<AgentState>("disconnected");
	let textInput = $state("");
	let copiedIndex = $state<number | null>(null);
	let errorMessage = $state<string | null>(null);

	let timers: ReturnType<typeof setTimeout>[] = [];
	let replyIndex = 0;

	function clearTimers() {
		timers.forEach(clearTimeout);
		timers = [];
	}

	function scheduleAssistantReply() {
		const reply = CANNED_REPLIES[replyIndex % CANNED_REPLIES.length];
		replyIndex += 1;
		timers.push(
			setTimeout(() => {
				messages = [...messages, { role: "assistant", content: reply }];
			}, 1200)
		);
	}

	function handleCall() {
		clearTimers();
		if (agentState === "disconnected" || agentState === null) {
			errorMessage = null;
			messages = [];
			agentState = "connecting";
			timers.push(
				setTimeout(() => {
					agentState = "connected";
					messages = [
						{
							role: "assistant",
							content: "Hi, you've reached customer support. How can I help you today?",
						},
					];
				}, 1500)
			);
		} else if (agentState === "connected") {
			agentState = "disconnecting";
			timers.push(
				setTimeout(() => {
					agentState = "disconnected";
					messages = [];
				}, 700)
			);
		}
	}

	function handleSendText() {
		const messageToSend = textInput.trim();
		if (!messageToSend) return;

		if (agentState === "disconnected" || agentState === null) {
			textInput = "";
			agentState = "connecting";
			timers.push(
				setTimeout(() => {
					agentState = "connected";
					messages = [{ role: "user", content: messageToSend }];
					scheduleAssistantReply();
				}, 800)
			);
		} else if (agentState === "connected") {
			messages = [...messages, { role: "user", content: messageToSend }];
			textInput = "";
			scheduleAssistantReply();
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			handleSendText();
		}
	}

	async function handleCopy(index: number, content: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch {
			// Insecure context or denied permission — don't flash the "Copied!"
			// state if the write actually failed.
			return;
		}
		copiedIndex = index;
		timers.push(
			setTimeout(() => {
				if (copiedIndex === index) copiedIndex = null;
			}, 2000)
		);
	}

	$effect(() => {
		return () => clearTimers();
	});

	const isCallActive = $derived(agentState === "connected");
	const isTransitioning = $derived(agentState === "connecting" || agentState === "disconnecting");

	function getInputVolume(): number {
		if (agentState !== "connected") return 0;
		return 0.3 + 0.2 * Math.sin(performance.now() / 500);
	}

	function getOutputVolume(): number {
		if (agentState !== "connected") return 0;
		return 0.3 + 0.2 * Math.sin(performance.now() / 700 + 1);
	}
</script>

<Card class={cn("mx-auto flex h-[380px] w-full flex-col gap-0 overflow-hidden", className)}>
	<CardHeader class="flex shrink-0 flex-row items-center justify-between pb-4">
		<div class="flex items-center gap-4">
			<div class="ring-border relative size-10 overflow-hidden rounded-full ring-1">
				<Orb class="h-full w-full" volumeMode="manual" {getInputVolume} {getOutputVolume} />
			</div>
			<div class="flex flex-col gap-0.5">
				<p class="text-sm leading-none font-medium">{DEFAULT_AGENT.name}</p>
				<div class="flex items-center gap-2">
					{#if errorMessage}
						<p class="text-destructive text-xs">{errorMessage}</p>
					{:else if agentState === "disconnected" || agentState === null}
						<p class="text-muted-foreground text-xs">Tap to start voice chat</p>
					{:else if agentState === "connected"}
						<p class="text-xs text-green-600">Connected</p>
					{:else if isTransitioning}
						<ShimmeringText text={agentState} class="text-xs capitalize" />
					{/if}
				</div>
			</div>
		</div>
		<div
			class={cn(
				"flex h-2 w-2 rounded-full transition-all duration-300",
				agentState === "connected" && "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",
				isTransitioning && "animate-pulse bg-white/40"
			)}
		></div>
	</CardHeader>
	<CardContent class="flex-1 overflow-hidden p-0">
		<Conversation class="h-full">
			<ConversationContent class="flex min-w-0 flex-col gap-2 p-6 pb-2">
				{#if messages.length === 0}
					<ConversationEmptyState
						title={agentState === "connecting"
							? "Starting conversation"
							: agentState === "connected"
								? "Start talking or type"
								: "Start a conversation"}
						description={agentState === "connecting"
							? "Connecting..."
							: agentState === "connected"
								? "Ready to chat"
								: "Type a message or tap the voice button"}
					>
						{#snippet icon()}
							<Orb class="size-12" />
						{/snippet}
					</ConversationEmptyState>
				{:else}
					{#each messages as message, index (index)}
						<div class="flex w-full flex-col gap-1">
							<Message from={message.role}>
								<MessageContent class="max-w-full min-w-0">
									<Response
										content={message.content}
										class="w-auto [overflow-wrap:anywhere] whitespace-pre-wrap"
									/>
								</MessageContent>
								{#if message.role === "assistant"}
									<div
										class="ring-border size-6 flex-shrink-0 self-end overflow-hidden rounded-full ring-1"
									>
										<Orb
											class="h-full w-full"
											agentState={isCallActive && index === messages.length - 1 ? "talking" : null}
										/>
									</div>
								{/if}
							</Message>
							{#if message.role === "assistant"}
								<div class="flex items-center gap-1">
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger>
												{#snippet child({ props })}
													<Button
														{...props}
														size="sm"
														variant="ghost"
														class="text-muted-foreground hover:text-foreground relative size-9 p-1.5"
														onclick={() => handleCopy(index, message.content)}
													>
														{#if copiedIndex === index}
															<CheckIcon class="size-4" />
														{:else}
															<CopyIcon class="size-4" />
														{/if}
														<span class="sr-only">{copiedIndex === index ? "Copied!" : "Copy"}</span
														>
													</Button>
												{/snippet}
											</TooltipTrigger>
											<TooltipContent>
												<p>{copiedIndex === index ? "Copied!" : "Copy"}</p>
											</TooltipContent>
										</Tooltip>
									</TooltipProvider>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	</CardContent>
	<CardFooter class="shrink-0 border-t">
		<div class="flex w-full items-center gap-2">
			<div class="flex flex-1 items-center gap-2">
				<Input
					bind:value={textInput}
					onkeydown={handleKeyDown}
					placeholder="Type a message..."
					class="h-9 focus-visible:ring-0 focus-visible:ring-offset-0"
					disabled={isTransitioning}
				/>
				<Button
					onclick={handleSendText}
					size="icon"
					variant="ghost"
					class="rounded-full"
					disabled={!textInput.trim() || isTransitioning}
				>
					<SendIcon class="size-4" />
					<span class="sr-only">Send message</span>
				</Button>
				{#if !isCallActive}
					<Button
						onclick={handleCall}
						size="icon"
						variant="ghost"
						class={cn("relative shrink-0 rounded-full transition-all")}
						disabled={isTransitioning}
					>
						<AudioLinesIcon class="size-4" />
						<span class="sr-only">Start voice call</span>
					</Button>
				{:else}
					<Button
						onclick={handleCall}
						size="icon"
						variant="secondary"
						class={cn("relative shrink-0 rounded-full transition-all")}
						disabled={isTransitioning}
					>
						<PhoneOffIcon class="size-4" />
						<span class="sr-only">End call</span>
					</Button>
				{/if}
			</div>
		</div>
	</CardFooter>
</Card>

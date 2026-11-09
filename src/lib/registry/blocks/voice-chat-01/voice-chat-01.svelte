<script lang="ts">
	import { onDestroy } from "svelte";
	import { useConversation } from "$lib/registry/ui/voice-session/use-conversation.svelte.js";
	import type { ConversationSession } from "$lib/registry/ui/voice-session/session.js";
	import type { ConversationAdapter } from "$lib/registry/ui/voice-session/types.js";
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

	let {
		session,
		adapter,
		class: className,
		name = "Customer Support",
	}: {
		session?: ConversationSession;
		adapter?: ConversationAdapter;
		class?: string;
		name?: string;
	} = $props();
	const voice = useConversation(() => session ?? adapter);
	const agentState = $derived(voice.snapshot.status);
	const errorMessage = $derived(voice.snapshot.error?.message);
	const isCallActive = $derived(agentState === "connected");
	const isTransitioning = $derived(agentState === "connecting" || agentState === "disconnecting");
	const configured = $derived(!!session || !!adapter);
	const getInputVolume = () => voice.session.getInputVolume();
	const getOutputVolume = () => voice.session.getOutputVolume();
	function handleCall() {
		if (isCallActive || agentState === "connecting") void voice.session.disconnect();
		else void voice.session.connect().catch(() => {});
	}
	let textInput = $state("");
	const messages = $derived(
		voice.snapshot.messages.map((m) => ({
			id: m.id,
			role: m.source === "user" ? ("user" as const) : ("assistant" as const),
			content: m.message,
		}))
	);
	let copiedIndex = $state<number | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
	async function handleSendText() {
		const text = textInput.trim();
		if (!text) return;
		try {
			await voice.session.sendMessage(text);
			textInput = "";
		} catch {
			/* Error is rendered from the session. */
		}
	}
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			void handleSendText();
		}
	}
	async function handleCopy(index: number, content: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch {
			return;
		}
		copiedIndex = index;
		clearTimeout(copyTimer);
		copyTimer = setTimeout(() => (copiedIndex = null), 2000);
	}
	onDestroy(() => clearTimeout(copyTimer));
</script>

<Card
	data-slot="voice-chat-01"
	class={cn("mx-auto flex h-[380px] w-full flex-col gap-0 overflow-hidden", className)}
>
	<CardHeader class="flex shrink-0 flex-row items-center justify-between pb-4">
		<div class="flex items-center gap-4">
			<div class="ring-border relative size-10 overflow-hidden rounded-full ring-1">
				<Orb
					class="h-full w-full"
					volumeMode="manual"
					{getInputVolume}
					{getOutputVolume}
					agentState={voice.snapshot.activity === "speaking"
						? "talking"
						: voice.snapshot.activity === "idle"
							? null
							: voice.snapshot.activity}
				/>
			</div>
			<div class="flex flex-col gap-0.5">
				<p class="text-sm leading-none font-medium">{name}</p>
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
					disabled={!configured || isTransitioning || voice.session.capabilities.text === false}
				/>
				<Button
					onclick={handleSendText}
					size="icon"
					variant="ghost"
					class="rounded-full"
					disabled={!configured ||
						!textInput.trim() ||
						isTransitioning ||
						voice.session.capabilities.text === false}
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
						disabled={!configured || agentState === "disconnecting"}
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
						disabled={!configured || agentState === "disconnecting"}
					>
						<PhoneOffIcon class="size-4" />
						<span class="sr-only">End call</span>
					</Button>
				{/if}
			</div>
		</div>
	</CardFooter>
</Card>

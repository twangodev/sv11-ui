<script lang="ts" module>
	import type { HTMLAttributes } from "svelte/elements";
	import type { ConversationAdapter, ConversationMessage } from "./types.js";

	export type ConversationBarProps = Omit<HTMLAttributes<HTMLDivElement>, "children"> & {
		/**
		 * Backend bridge that owns the session lifecycle — connecting, streaming
		 * messages, and muting. Conforms to
		 * [`ConversationAdapter`](/docs/providers#conversationadapter).
		 */
		adapter?: ConversationAdapter;
		/** Share a session with other controls or blocks. Its creator owns its lifetime. */
		session?: import("../voice-session/session.js").ConversationSession;
		/**
		 * Label shown in the waveform slot while the session is disconnected.
		 * @default "Customer Support"
		 */
		disconnectedText?: string;
		/** Extra classes merged onto the inner waveform container. */
		waveformClassName?: string;
		/** Fired after the adapter reports a successful connection. */
		onConnect?: () => void;
		/** Fired after the adapter reports disconnection. */
		onDisconnect?: () => void;
		/** Fired when the adapter surfaces an error or `connect()` rejects. */
		onError?: (error: Error) => void;
		/** Fired for each message emitted by the adapter (both user and AI turns). */
		onMessage?: (message: ConversationMessage) => void;
		/** Fired after a text-input message has been handed off to the adapter. */
		onSendMessage?: (message: string) => void;
		/** Bindable ref to the root `<div>` element. */
		ref?: HTMLDivElement | null;
	};
</script>

<script lang="ts">
	import { untrack } from "svelte";
	import { useConversation } from "../voice-session/use-conversation.svelte.js";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { LiveWaveform } from "$lib/registry/ui/live-waveform/index.js";
	import { Separator } from "$lib/registry/ui/separator/index.js";
	import { Textarea } from "$lib/registry/ui/textarea/index.js";
	import MicIcon from "@lucide/svelte/icons/mic";
	import MicOffIcon from "@lucide/svelte/icons/mic-off";
	import PhoneIcon from "@lucide/svelte/icons/phone";
	import XIcon from "@lucide/svelte/icons/x";
	import KeyboardIcon from "@lucide/svelte/icons/keyboard";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import ArrowUpIcon from "@lucide/svelte/icons/arrow-up";

	let {
		adapter,
		session,
		disconnectedText = "Customer Support",
		waveformClassName,
		onConnect,
		onDisconnect,
		onError,
		onMessage,
		onSendMessage,
		class: className,
		ref = $bindable(null),
		...restProps
	}: ConversationBarProps = $props();

	const voice = useConversation(() => session ?? adapter);
	const isMuted = $derived(voice.snapshot.muted);
	const agentState = $derived(voice.snapshot.status);
	let keyboardOpen = $state(false);
	let textInput = $state("");
	const isConnected = $derived(agentState === "connected");
	const isConnecting = $derived(agentState === "connecting");

	$effect(() => {
		let previous = voice.session.snapshot;
		return voice.session.subscribe((next) => {
			const before = previous;
			previous = next;
			untrack(() => {
				if (next.status === "connected" && before.status !== "connected") onConnect?.();
				if (next.status === "disconnected" && before.status !== "disconnected") {
					keyboardOpen = false;
					onDisconnect?.();
				}
				if (next.error && next.error !== before.error) onError?.(next.error);
			});
		});
	});
	$effect(() => voice.session.subscribeMessages((message) => untrack(() => onMessage?.(message))));
	function handleStartOrEnd() {
		if (isConnected || isConnecting) void voice.session.disconnect();
		else void voice.session.connect().catch(() => {});
	}
	function toggleMute() {
		void voice.session.setMuted(!isMuted).catch(() => {});
	}
	async function handleSendText() {
		if (!textInput.trim()) return;
		const text = textInput;
		try {
			await voice.session.sendMessage(text);
			textInput = "";
			onSendMessage?.(text);
		} catch {
			return;
		}
	}
	function handleContextualUpdate() {
		if (textInput.trim() && isConnected && voice.session.capabilities.context !== false)
			void voice.session.sendContextualUpdate(textInput).catch(() => {});
	}
	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSendText();
		}
	}
</script>

<div
	bind:this={ref}
	data-slot="conversation-bar"
	class={cn("flex w-full items-end justify-center p-4", className)}
	{...restProps}
>
	<Card class="m-0 w-full gap-0 border p-0 shadow-lg">
		{#if voice.snapshot.error}<p role="alert" class="text-destructive px-3 pt-2 text-sm">
				{voice.snapshot.error.message}
			</p>{/if}
		<div class="flex flex-col-reverse">
			<div>
				{#if keyboardOpen}
					<Separator />
				{/if}
				<div class="flex items-center justify-between gap-2 p-2">
					<div class="h-8 w-[120px] md:h-10">
						<div
							class={cn(
								"flex h-full items-center gap-2 rounded-md py-1",
								"bg-foreground/5 text-foreground/70"
							)}
						>
							<div class="h-full flex-1">
								<div
									class={cn(
										"relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden rounded-sm",
										waveformClassName
									)}
								>
									{#key agentState === "disconnected" ? "idle" : "active"}
										<LiveWaveform
											active={isConnected && !isMuted}
											getLevel={voice.session.getInputVolume}
											processing={isConnecting}
											barWidth={3}
											barGap={1}
											barRadius={4}
											fadeEdges={true}
											fadeWidth={24}
											sensitivity={1.8}
											smoothingTimeConstant={0.85}
											height={20}
											mode="static"
											class={cn(
												"h-full w-full transition-opacity duration-300",
												agentState === "disconnected" && "opacity-0"
											)}
										/>
									{/key}
									{#if agentState === "disconnected"}
										<div class="absolute inset-0 flex items-center justify-center">
											<span class="text-foreground/50 text-[10px] font-medium">
												{disconnectedText}
											</span>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
					<div class="flex items-center">
						<Button
							variant="ghost"
							size="icon"
							onclick={toggleMute}
							aria-pressed={isMuted}
							aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
							class={cn(isMuted ? "bg-foreground/5" : "")}
							disabled={!isConnected || voice.session.capabilities.mute === false}
						>
							{#if isMuted}
								<MicOffIcon />
							{:else}
								<MicIcon />
							{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onclick={() => (keyboardOpen = !keyboardOpen)}
							aria-pressed={keyboardOpen}
							aria-label={keyboardOpen ? "Close text input" : "Open text input"}
							class="relative"
							disabled={!isConnected || voice.session.capabilities.text === false}
						>
							<KeyboardIcon
								class={"h-5 w-5 transform-gpu transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] " +
									(keyboardOpen ? "scale-75 opacity-0" : "scale-100 opacity-100")}
							/>
							<ChevronDownIcon
								class={"absolute inset-0 m-auto h-5 w-5 transform-gpu transition-all delay-50 duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] " +
									(keyboardOpen ? "scale-100 opacity-100" : "scale-75 opacity-0")}
							/>
						</Button>
						<Separator orientation="vertical" class="mx-1 -my-2.5" />
						<Button
							variant="ghost"
							size="icon"
							onclick={handleStartOrEnd}
							aria-label={isConnected || isConnecting ? "End conversation" : "Start conversation"}
							disabled={agentState === "disconnecting"}
						>
							{#if isConnected || isConnecting}
								<XIcon class="h-5 w-5" />
							{:else}
								<PhoneIcon class="h-5 w-5" />
							{/if}
						</Button>
					</div>
				</div>
			</div>

			<div
				class={cn(
					"overflow-hidden transition-all duration-300 ease-out",
					keyboardOpen ? "max-h-[120px]" : "max-h-0"
				)}
			>
				<div class="relative px-2 pt-2 pb-2">
					<Textarea
						bind:value={textInput}
						oninput={handleContextualUpdate}
						onkeydown={handleKeyDown}
						placeholder="Enter your message..."
						class="min-h-[100px] resize-none border-0 pr-12 shadow-none focus-visible:ring-0"
						disabled={!isConnected}
					/>
					<Button
						size="icon"
						variant="ghost"
						onclick={handleSendText}
						aria-label="Send message"
						disabled={!textInput.trim() || !isConnected}
						class="absolute right-3 bottom-3 h-8 w-8"
					>
						<ArrowUpIcon class="h-4 w-4" />
					</Button>
				</div>
			</div>
		</div>
	</Card>
</div>

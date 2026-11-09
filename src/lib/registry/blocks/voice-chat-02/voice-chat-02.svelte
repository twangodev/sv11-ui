<script lang="ts">
	import { useConversation } from "$lib/registry/ui/voice-session/use-conversation.svelte.js";
	import type { ConversationSession } from "$lib/registry/ui/voice-session/session.js";
	import type { ConversationAdapter } from "$lib/registry/ui/voice-session/types.js";
	import { fly } from "svelte/transition";
	import Loader2Icon from "@lucide/svelte/icons/loader-2";
	import PhoneIcon from "@lucide/svelte/icons/phone";
	import PhoneOffIcon from "@lucide/svelte/icons/phone-off";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card } from "$lib/registry/ui/card/index.js";
	import { Orb } from "$lib/registry/ui/orb/index.js";
	import { ShimmeringText } from "$lib/registry/ui/shimmering-text/index.js";
	import { cn } from "$lib/utils.js";

	let {
		session,
		adapter,
		class: className,
		name = "Customer Support",
		description = "Tap to start voice chat",
	}: {
		session?: ConversationSession;
		adapter?: ConversationAdapter;
		class?: string;
		name?: string;
		description?: string;
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
</script>

<Card
	data-slot="voice-chat-02"
	class={cn(
		"flex h-[400px] w-full flex-col items-center justify-center overflow-hidden p-6",
		className
	)}
>
	<div class="flex flex-col items-center gap-6">
		<div class="relative size-32">
			<div
				class="bg-muted relative h-full w-full rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]"
			>
				<div
					class="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_0_12px_rgba(0,0,0,0.3)]"
				>
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
			</div>
		</div>

		<div class="flex flex-col items-center gap-2">
			<h2 class="text-xl font-semibold">{name}</h2>
			{#if errorMessage}
				<p
					class="text-destructive text-center text-sm"
					in:fly={{ y: -10, duration: 200 }}
					out:fly={{ y: 10, duration: 200 }}
				>
					{errorMessage}
				</p>
			{:else if agentState === "disconnected" || agentState === null}
				<p
					class="text-muted-foreground text-sm"
					in:fly={{ y: -10, duration: 200 }}
					out:fly={{ y: 10, duration: 200 }}
				>
					{description}
				</p>
			{:else}
				<div
					class="flex items-center gap-2"
					in:fly={{ y: -10, duration: 200 }}
					out:fly={{ y: 10, duration: 200 }}
				>
					<div
						class={cn(
							"h-2 w-2 rounded-full transition-all duration-300",
							agentState === "connected" && "bg-green-500",
							isTransitioning && "bg-primary/60 animate-pulse"
						)}
					></div>
					<span class="text-sm capitalize">
						{#if isTransitioning}
							<ShimmeringText text={agentState} />
						{:else}
							<span class="text-green-600">Connected</span>
						{/if}
					</span>
				</div>
			{/if}
		</div>

		<Button
			onclick={handleCall}
			disabled={!configured || agentState === "disconnecting"}
			size="icon"
			variant={isCallActive ? "secondary" : "default"}
			class="h-12 w-12 rounded-full"
		>
			{#if isTransitioning}
				<Loader2Icon class="h-5 w-5 animate-spin" />
			{:else if isCallActive}
				<PhoneOffIcon class="h-5 w-5" />
			{:else}
				<PhoneIcon class="h-5 w-5" />
			{/if}
		</Button>
	</div>
</Card>

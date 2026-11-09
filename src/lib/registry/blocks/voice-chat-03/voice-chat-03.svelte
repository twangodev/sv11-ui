<script lang="ts">
	import { onDestroy } from "svelte";
	import { useConversation } from "$lib/registry/ui/voice-session/use-conversation.svelte.js";
	import type { ConversationSession } from "$lib/registry/ui/voice-session/session.js";
	import type { ConversationAdapter } from "$lib/registry/ui/voice-session/types.js";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import { Button } from "$lib/registry/ui/button/index.js";
	import { Card, CardContent } from "$lib/registry/ui/card/index.js";
	import {
		Conversation,
		ConversationContent,
		ConversationEmptyState,
		ConversationScrollButton,
	} from "$lib/registry/ui/conversation/index.js";
	import { ConversationBar } from "$lib/registry/ui/conversation-bar/index.js";

	import { Message, MessageContent } from "$lib/registry/ui/message/index.js";
	import { Orb } from "$lib/registry/ui/orb/index.js";
	import { Response } from "$lib/registry/ui/response/index.js";
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
	}: {
		session?: ConversationSession;
		adapter?: ConversationAdapter;
		class?: string;
	} = $props();
	const voice = useConversation(() => session ?? adapter);
	const messages = $derived(
		voice.snapshot.messages.map((m) => ({
			id: m.id,
			role: m.source === "user" ? ("user" as const) : ("assistant" as const),
			content: m.message,
		}))
	);
	let copiedIndex = $state<number | null>(null);
	let copyTimer: ReturnType<typeof setTimeout> | undefined;
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

<div data-slot="voice-chat-03" class={cn("relative mx-auto h-[600px] w-full", className)}>
	<Card class="flex h-full w-full flex-col gap-0 overflow-hidden">
		<CardContent class="relative flex-1 overflow-hidden p-0">
			<Conversation class="absolute inset-0 pb-[88px]">
				<ConversationContent class="flex min-w-0 flex-col gap-2 p-6 pb-6">
					{#if messages.length === 0}
						<ConversationEmptyState
							title="Start a conversation"
							description="Tap the phone button or type a message"
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
											<Orb class="h-full w-full" />
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
															<span class="sr-only"
																>{copiedIndex === index ? "Copied!" : "Copy"}</span
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
				<ConversationScrollButton class="bottom-[100px]" />
			</Conversation>
			<div class="absolute right-0 bottom-0 left-0 flex justify-center">
				<ConversationBar class="w-full max-w-2xl" session={voice.session} />
			</div>
		</CardContent>
	</Card>
</div>

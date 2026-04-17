<script lang="ts">
	import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
	import * as Conversation from "$lib/registry/ui/conversation/index.js";
	import { Message, MessageContent } from "$lib/registry/ui/message/index.js";
	import { Response } from "$lib/registry/ui/response/index.js";

	type Turn = { id: string; role: "user" | "assistant"; text: string };

	const allMessages: Turn[] = [
		{ id: "1", role: "user", text: "Hey, I need help with my order" },
		{
			id: "2",
			role: "assistant",
			text: "Hi! I'd be happy to help you with your order. Could you please provide your order number?",
		},
		{ id: "3", role: "user", text: "It's ORDER-12345" },
		{
			id: "4",
			role: "assistant",
			text: "Thank you! Let me pull up your order details. I can see that your order was placed on March 15th and is currently being processed. It should ship within the next 1-2 business days. Is there anything specific you'd like to know about this order?",
		},
		{ id: "5", role: "user", text: "Can I change the shipping address?" },
		{
			id: "6",
			role: "assistant",
			text: "Absolutely! Since the order hasn't shipped yet, I can update the shipping address for you. What would you like the new address to be?",
		},
	];

	let messages: Turn[] = $state([]);
	let streamingMessageIndex: number | null = $state(null);
	let streamingContent = $state("");

	$effect(() => {
		const timeouts: ReturnType<typeof setTimeout>[] = [];
		const intervals: ReturnType<typeof setInterval>[] = [];
		let currentMessageIndex = 0;

		const addNextMessage = () => {
			if (currentMessageIndex >= allMessages.length) return;

			const message = allMessages[currentMessageIndex];

			if (message.role === "assistant") {
				streamingMessageIndex = currentMessageIndex;
				streamingContent = "";

				const words = message.text.split(" ");
				let wordIndex = 0;

				const streamInterval = setInterval(() => {
					if (wordIndex < words.length) {
						streamingContent += (wordIndex === 0 ? "" : " ") + words[wordIndex];
						wordIndex++;
					} else {
						clearInterval(streamInterval);
						messages = [...messages, message];
						streamingMessageIndex = null;
						streamingContent = "";
						currentMessageIndex++;
						timeouts.push(setTimeout(addNextMessage, 500));
					}
				}, 100);

				intervals.push(streamInterval);
			} else {
				messages = [...messages, message];
				currentMessageIndex++;
				timeouts.push(setTimeout(addNextMessage, 800));
			}
		};

		timeouts.push(setTimeout(addNextMessage, 1000));

		return () => {
			timeouts.forEach(clearTimeout);
			intervals.forEach(clearInterval);
		};
	});
</script>

<div
	class="bg-card relative mx-auto h-full w-full max-w-2xl min-h-0 flex-1 overflow-hidden rounded-lg border"
>
	<Conversation.Root class="absolute inset-0">
		<Conversation.Content>
			{#if messages.length === 0 && streamingMessageIndex === null}
				<Conversation.EmptyState
					title="Start a conversation"
					description="This is a simulated conversation"
				>
					{#snippet icon()}
						<MessageCircleIcon class="size-12" />
					{/snippet}
				</Conversation.EmptyState>
			{:else}
				{#each messages as message (message.id)}
					<Message from={message.role}>
						<MessageContent>
							<Response content={message.text} />
						</MessageContent>
					</Message>
				{/each}
				{#if streamingMessageIndex !== null}
					{@const streamingMsg = allMessages[streamingMessageIndex]}
					<Message from={streamingMsg.role}>
						<MessageContent>
							<Response content={streamingContent || "\u200B"} />
						</MessageContent>
					</Message>
				{/if}
			{/if}
		</Conversation.Content>
		<Conversation.ScrollButton />
	</Conversation.Root>
</div>

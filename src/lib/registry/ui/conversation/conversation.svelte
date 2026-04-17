<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { StickToBottom } from "stick-to-bottom-svelte";
	import { cn } from "$lib/utils.js";
	import { setConversationContext } from "./context.js";

	let {
		class: className,
		children,
		initial = "smooth" as ScrollBehavior,
		resize = "smooth" as ScrollBehavior,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & {
		/** Conversation body — typically a `Conversation.Content` and optional `Conversation.ScrollButton`. */
		children?: Snippet;
		/**
		 * Scroll behavior used on first mount to anchor to the bottom.
		 * @default "smooth"
		 */
		initial?: ScrollBehavior;
		/**
		 * Scroll behavior used when content resizes (e.g. new messages streamed in)
		 * while the user is anchored to the bottom.
		 * @default "smooth"
		 */
		resize?: ScrollBehavior;
	} = $props();

	let scrollEl: HTMLDivElement | null = $state(null);
	let contentEl: HTMLElement | null = $state(null);

	const stickToBottom = new StickToBottom({
		scrollElement: () => scrollEl as HTMLElement,
		contentElement: () => contentEl as HTMLElement,
		initial,
		resize,
	});

	setConversationContext({
		setContentElement(el) {
			contentEl = el;
		},
		get isAtBottom() {
			return stickToBottom.isAtBottom;
		},
		scrollToBottom() {
			void stickToBottom.scrollToBottom({});
		},
	});
</script>

<div
	bind:this={scrollEl}
	{...restProps}
	data-slot="conversation"
	role="log"
	aria-live="polite"
	aria-relevant="additions"
	class={cn("relative flex-1 overflow-y-auto", className)}
>
	{@render children?.()}
</div>

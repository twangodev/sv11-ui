<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	export const messageContentVariants = tv({
		base: "is-user:dark flex flex-col gap-2 overflow-hidden rounded-lg text-sm",
		variants: {
			variant: {
				contained: [
					"max-w-[80%] px-4 py-3",
					"group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground",
					"group-[.is-assistant]:bg-secondary group-[.is-assistant]:text-foreground",
				],
				flat: [
					"group-[.is-user]:max-w-[80%] group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
					"group-[.is-assistant]:text-foreground",
				],
			},
		},
		defaultVariants: {
			variant: "contained",
		},
	});

	export type MessageContentVariants = VariantProps<typeof messageContentVariants>;
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let {
		class: className,
		variant,
		children,
		...restProps
	}: HTMLAttributes<HTMLDivElement> & MessageContentVariants & { children?: Snippet } = $props();
</script>

<div
	data-slot="message-content"
	class={cn(messageContentVariants({ variant }), className)}
	{...restProps}
>
	{@render children?.()}
</div>

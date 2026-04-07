<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils.js";

	let { class: className, children, ...restProps }: HTMLAttributes<HTMLElement> = $props();
</script>

<!-- svelte-ignore a11y_figcaption_parent -->
<figcaption class={cn("text-code-foreground flex items-center gap-2", className)} {...restProps}>
	{@render children?.()}
</figcaption>

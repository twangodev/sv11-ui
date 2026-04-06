<script lang="ts">
	import { cn } from "$lib/utils.js";
	import { Avatar as AvatarPrimitive } from "bits-ui";
	import {
		Avatar,
		AvatarImage,
		AvatarFallback,
	} from "$lib/registry/ui/avatar/index.js";

	let {
		src,
		name,
		class: className,
		...restProps
	}: AvatarPrimitive.RootProps & {
		src: string;
		name?: string;
	} = $props();
</script>

<Avatar class={cn("ring-border size-8 ring-1", className)} {...restProps}>
	<AvatarImage alt="" class="mt-0 mb-0" {src} />
	<AvatarFallback>{name?.slice(0, 2) || "ME"}</AvatarFallback>
</Avatar>
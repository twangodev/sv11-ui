<script lang="ts" module>
	import type { Voice } from "./types.js";

	export type VoicePickerProps = {
		/** Voices to display in the picker. Any object conforming to `Voice` works. */
		voices: Voice[];
		/** Selected voice ID for controlled usage. */
		value?: string;
		/** Called with the voice ID when the user picks a voice. */
		onValueChange?: (value: string) => void;
		/**
		 * Placeholder shown on the trigger when no voice is selected.
		 * @default "Select a voice..."
		 */
		placeholder?: string;
		/** Extra classes forwarded to the trigger button. */
		class?: string;
		/** Controlled popover open state. Leave undefined for uncontrolled. */
		open?: boolean;
		/** Called when the popover open state changes. */
		onOpenChange?: (open: boolean) => void;
	};
</script>

<script lang="ts">
	import ChevronsUpDownIcon from "@lucide/svelte/icons/chevrons-up-down";
	import { AudioPlayer } from "../audio-player/index.js";
	import { Button } from "../button/index.js";
	import * as Command from "../command/index.js";
	import { Orb } from "../orb/index.js";
	import * as Popover from "../popover/index.js";
	import { cn } from "$lib/utils.js";
	import VoicePickerItem from "./voice-picker-item.svelte";

	let {
		voices,
		value,
		onValueChange,
		placeholder = "Select a voice...",
		open,
		onOpenChange,
		class: className,
	}: VoicePickerProps = $props();

	let internalOpen = $state(false);
	const isOpenControlled = $derived(open !== undefined);
	const isOpen = $derived(isOpenControlled ? open! : internalOpen);

	function setIsOpen(next: boolean) {
		if (isOpenControlled) onOpenChange?.(next);
		else internalOpen = next;
	}

	const selectedVoice = $derived(voices.find((v) => v.id === value));
</script>

<AudioPlayer>
	<Popover.Root open={isOpen} onOpenChange={setIsOpen}>
		<Popover.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					role="combobox"
					aria-expanded={isOpen}
					class={cn("w-full justify-between", className)}
				>
					{#if selectedVoice}
						<div class="flex items-center gap-2 overflow-hidden">
							<div class="relative size-6 shrink-0 overflow-visible">
								<Orb agentState="thinking" class="absolute inset-0" />
							</div>
							<span class="truncate">{selectedVoice.name}</span>
						</div>
					{:else}
						{placeholder}
					{/if}
					<ChevronsUpDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-[var(--bits-popover-anchor-width)] p-0">
			<Command.Root>
				<Command.Input placeholder="Search voices..." />
				<Command.List>
					<Command.Empty>No voice found.</Command.Empty>
					<Command.Group>
						{#each voices as voice (voice.id)}
							<VoicePickerItem
								{voice}
								isSelected={value === voice.id}
								onSelect={() => onValueChange?.(voice.id)}
							/>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</AudioPlayer>

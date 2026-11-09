<script lang="ts" module>
	export type MicSelectorProps = {
		/**
		 * Selected microphone `deviceId`. Leave unset for uncontrolled mode —
		 * the first available device is auto-selected. A shared session takes precedence.
		 */
		value?: string;
		/** Shared state takes precedence over value/muted. Controls are available while connected. */
		session?: import("../voice-session/session.js").ConversationSession;
		/** Called when the user picks a different microphone from the dropdown. */
		onValueChange?: (deviceId: string) => void;
		/**
		 * Mute state. Leave unset for uncontrolled mode, where the component
		 * tracks mute internally.
		 */
		muted?: boolean;
		/** Called when the user toggles the mute button. */
		onMutedChange?: (muted: boolean) => void;
		/** Disables the trigger button. */
		disabled?: boolean;
		class?: string;
	};
</script>

<script lang="ts">
	import { useConversation } from "../voice-session/use-conversation.svelte.js";
	import Check from "@lucide/svelte/icons/check";
	import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
	import Mic from "@lucide/svelte/icons/mic";
	import MicOff from "@lucide/svelte/icons/mic-off";
	import { Button } from "$lib/registry/ui/button/index.js";
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger,
	} from "$lib/registry/ui/dropdown-menu/index.js";
	import { LiveWaveform } from "$lib/registry/ui/live-waveform/index.js";
	import { cn } from "$lib/utils.js";
	import { useAudioDevices } from "./use-audio-devices.svelte.js";

	let {
		value,
		session,
		onValueChange,
		muted,
		onMutedChange,
		disabled,
		class: className,
	}: MicSelectorProps = $props();

	const audio = useAudioDevices();
	const voice = useConversation(() => session);

	let internalDeviceId = $state("");
	let internalMuted = $state(false);
	let isDropdownOpen = $state(false);

	const isMuted = $derived(
		session ? voice.snapshot.muted : muted !== undefined ? muted : internalMuted
	);
	const defaultDeviceId = $derived(audio.devices[0]?.deviceId ?? "");
	const selectedDevice = $derived(
		session
			? (voice.snapshot.inputDeviceId ?? defaultDeviceId)
			: (value ?? (internalDeviceId || defaultDeviceId))
	);
	const canSelectDevice = $derived(
		!session ||
			(voice.snapshot.status === "connected" && voice.session.capabilities.inputDevice !== false)
	);
	const canMute = $derived(
		!session || (voice.snapshot.status === "connected" && voice.session.capabilities.mute !== false)
	);
	const currentDevice = $derived(
		audio.devices.find((d) => d.deviceId === selectedDevice) ??
			audio.devices[0] ?? {
				label: audio.loading ? "Loading..." : "No microphone",
				deviceId: "",
				groupId: "",
			}
	);
	const isPreviewActive = $derived(isDropdownOpen && !isMuted);

	$effect(() => {
		if (!session && value === undefined && !internalDeviceId && defaultDeviceId) {
			internalDeviceId = defaultDeviceId;
			onValueChange?.(defaultDeviceId);
		}
	});

	async function handleDeviceSelect(deviceId: string) {
		if (!canSelectDevice) return;
		const targetSession = session;
		if (targetSession) {
			try {
				await targetSession.setInputDevice(deviceId);
			} catch {
				return;
			}
			if (targetSession !== session) return;
		} else if (value === undefined) internalDeviceId = deviceId;
		onValueChange?.(deviceId);
	}

	async function handleDropdownOpenChange(open: boolean) {
		isDropdownOpen = open;
		if (open && !session && !audio.hasPermission && !audio.loading) {
			await audio.loadDevices();
		}
	}

	async function toggleMute() {
		if (!canMute) return;
		const newMuted = !isMuted;
		const targetSession = session;
		if (targetSession) {
			try {
				await targetSession.setMuted(newMuted);
			} catch {
				return;
			}
			if (targetSession !== session) return;
		} else if (muted === undefined) internalMuted = newMuted;
		onMutedChange?.(newMuted);
	}
</script>

<DropdownMenu onOpenChange={handleDropdownOpenChange}>
	<DropdownMenuTrigger>
		{#snippet child({ props })}
			<Button
				variant="ghost"
				size="sm"
				{...props}
				class={cn(
					"hover:bg-accent flex w-40 min-w-0 shrink cursor-pointer items-center gap-1.5 sm:w-48",
					className
				)}
				disabled={audio.loading || disabled}
			>
				{#if isMuted}
					<MicOff class="h-4 w-4 flex-shrink-0" />
				{:else}
					<Mic class="h-4 w-4 flex-shrink-0" />
				{/if}
				<span class="min-w-0 flex-1 truncate text-left text-xs sm:text-sm">
					{currentDevice.label}
				</span>
				<ChevronsUpDown class="h-3 w-3 flex-shrink-0" />
			</Button>
		{/snippet}
	</DropdownMenuTrigger>
	<DropdownMenuContent align="center" side="top" class="w-72">
		{#if audio.loading}
			<DropdownMenuItem disabled>Loading devices...</DropdownMenuItem>
		{:else if audio.error}
			<DropdownMenuItem disabled>Error: {audio.error}</DropdownMenuItem>
		{:else}
			{#each audio.devices as device (device.deviceId)}
				<DropdownMenuItem
					disabled={!canSelectDevice}
					onSelect={(e) => {
						e.preventDefault();
						handleDeviceSelect(device.deviceId);
					}}
					class="flex items-center justify-between"
				>
					<span class="truncate">{device.label}</span>
					{#if selectedDevice === device.deviceId}
						<Check class="h-4 w-4 flex-shrink-0" />
					{/if}
				</DropdownMenuItem>
			{/each}
		{/if}

		{#if audio.devices.length > 0}
			<DropdownMenuSeparator />
			<div class="flex items-center gap-2 p-2">
				<Button
					variant="ghost"
					size="sm"
					disabled={!canMute}
					onclick={(e) => {
						e.preventDefault();
						toggleMute();
					}}
					class="h-8 gap-2"
				>
					{#if isMuted}
						<MicOff class="h-4 w-4" />
					{:else}
						<Mic class="h-4 w-4" />
					{/if}
					<span class="text-sm">{isMuted ? "Unmute" : "Mute"}</span>
				</Button>
				<div class="bg-accent ml-auto w-16 overflow-hidden rounded-md p-1.5">
					<LiveWaveform
						active={isPreviewActive}
						getLevel={session?.getInputVolume}
						deviceId={selectedDevice || defaultDeviceId}
						mode="static"
						height={15}
						barWidth={3}
						barGap={1}
					/>
				</div>
			</div>
		{/if}
	</DropdownMenuContent>
</DropdownMenu>

<script lang="ts">
	import VoiceChat01 from "../blocks/voice-chat-01/voice-chat-01.svelte";
	import { createDemoConversation } from "./demo-conversation.js";
	let { class: className }: { class?: string } = $props();
	const adapter = createDemoConversation();
</script>

<VoiceChat01 {adapter} class={className} />

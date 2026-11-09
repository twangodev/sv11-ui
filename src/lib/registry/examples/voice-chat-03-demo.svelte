<script lang="ts">
	import VoiceChat03 from "../blocks/voice-chat-03/voice-chat-03.svelte";
	import { createDemoConversation } from "./demo-conversation.js";
	const adapter = createDemoConversation();
</script>

<VoiceChat03 {adapter} />

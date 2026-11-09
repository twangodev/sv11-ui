<script lang="ts">
	import VoiceChat02 from "../blocks/voice-chat-02/voice-chat-02.svelte";
	import { createDemoConversation } from "./demo-conversation.js";
	const adapter = createDemoConversation();
</script>

<VoiceChat02 {adapter} />

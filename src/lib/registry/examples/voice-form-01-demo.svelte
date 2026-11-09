<script lang="ts">
	import VoiceForm01 from "../blocks/voice-form-01/voice-form-01.svelte";
	import type { ExampleFormValues } from "../blocks/voice-form-01/schema.js";
	const transcribe = async () => "My name is Alex Rivera";
	const extractFields = async (): Promise<Partial<ExampleFormValues>> => ({
		firstName: "Alex",
		lastName: "Rivera",
	});
</script>

<div class="space-y-3">
	<VoiceForm01 {transcribe} {extractFields} />
	<p class="text-muted-foreground text-xs">
		Record and stop to try the local sample “Alex Rivera”.
	</p>
</div>

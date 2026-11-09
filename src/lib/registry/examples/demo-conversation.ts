import type { ConversationAdapter, ConversationConfig } from "../ui/voice-session/types.js";

/** Documentation fixture only. Production blocks never create a mock backend. */
export function createDemoConversation(): ConversationAdapter {
	let config: ConversationConfig | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let connected = false;
	return {
		capabilities: { text: true, context: true, mute: true, audioLevels: true },
		async connect(next) {
			config = next;
			connected = true;
			next.onConnect();
			next.onMessage({
				id: "greeting",
				source: "ai",
				message: "Hi! This preview uses local sample responses. How can I help?",
				final: true,
			});
		},
		disconnect() {
			clearTimeout(timer);
			connected = false;
			config?.onDisconnect();
			config = null;
		},
		sendMessage(text) {
			config?.onActivityChange?.("thinking");
			clearTimeout(timer);
			timer = setTimeout(() => {
				config?.onMessage({ source: "ai", message: `You said: ${text}`, final: true });
				config?.onActivityChange?.("listening");
			}, 400);
		},
		sendContextualUpdate() {},
		setMuted() {},
		getInputVolume: () => (connected ? 0.15 : 0),
		getOutputVolume: () => 0,
	};
}

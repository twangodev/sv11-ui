import {
	RTVIEvent,
	type PipecatClient,
	type RTVIEventHandler,
	type TransportConnectionParams,
} from "@pipecat-ai/client-js";
import type { ConversationAdapter } from "../types.js";

/** Pass a dedicated SDK client configured with your chosen transport. */
export function createPipecatConversation(
	client: PipecatClient,
	connection: () => TransportConnectionParams | Promise<TransportConnectionParams>
): ConversationAdapter {
	let cleanup: (() => void)[] = [];
	let generation = 0,
		input = 0,
		output = 0,
		utterance = 0;
	const audio = new Map<MediaStreamTrack, HTMLMediaElement>();
	return {
		capabilities: {
			text: true,
			context: true,
			mute: true,
			inputDevice: true,
			audioLevels: true,
			interrupt: false,
		},
		async connect(config) {
			const id = ++generation;
			const on = <E extends RTVIEvent>(event: E, handler: RTVIEventHandler<E>) => {
				client.on(event, handler);
				cleanup.push(() => client.off(event, handler));
			};
			on(RTVIEvent.Disconnected, () => config.onDisconnect());
			on(RTVIEvent.BotStartedSpeaking, () => config.onActivityChange?.("speaking"));
			on(RTVIEvent.BotStoppedSpeaking, () => config.onActivityChange?.("listening"));
			on(RTVIEvent.BotLlmStarted, () => config.onActivityChange?.("thinking"));
			on(RTVIEvent.UserStartedSpeaking, () => config.onActivityChange?.("listening"));
			on(RTVIEvent.LocalAudioLevel, (value) => {
				input = value;
				config.onAudioLevels?.({ input, output });
			});
			on(RTVIEvent.RemoteAudioLevel, (value) => {
				output = value;
				config.onAudioLevels?.({ input, output });
			});
			on(RTVIEvent.UserInput, (data) => {
				config.onMessage({
					id: data.msg_id ?? `pipecat-${id}-user-${utterance}`,
					source: "user",
					message: data.text,
					final: data.final,
				});
				if (data.final) ++utterance;
			});
			on(RTVIEvent.BotOutput, (data) => {
				if (data.output_type === "word" || data.output_type === "token") return;
				config.onMessage({
					id: data.segment_id === undefined ? undefined : `pipecat-${id}-bot-${data.segment_id}`,
					source: "ai",
					message: data.text,
					final: true,
				});
			});
			on(RTVIEvent.Error, (data) =>
				config.onError(
					new Error(
						String(
							data.data && typeof data.data === "object" && "error" in data.data
								? data.data.error
								: "Pipecat connection failed."
						)
					)
				)
			);
			on(RTVIEvent.TrackStarted, (track, participant) => {
				if (track.kind !== "audio") return;
				if (participant?.local) {
					config.onInputStream?.(new MediaStream([track]));
					return;
				}
				const element = new Audio();
				element.srcObject = new MediaStream([track]);
				audio.set(track, element);
				void element.play().catch((error) => config.onError(error));
			});
			on(RTVIEvent.TrackStopped, (track) => {
				const element = audio.get(track);
				if (element) {
					element.pause();
					element.srcObject = null;
					audio.delete(track);
				}
			});
			const params = await connection();
			if (id !== generation || config.signal?.aborted) return;
			await client.connect(params);
			if (id !== generation || config.signal?.aborted) {
				await client.disconnect();
				return;
			}
			config.onConnect();
		},
		async disconnect() {
			++generation;
			cleanup.forEach((fn) => fn());
			cleanup = [];
			input = output = 0;
			for (const element of audio.values()) {
				element.pause();
				element.srcObject = null;
			}
			audio.clear();
			await client.disconnect();
		},
		async sendMessage(text) {
			await client.sendText(text);
		},
		async sendContextualUpdate(text) {
			await client.sendText(text, { run_immediately: false });
		},
		setMuted: (muted) => client.enableMic(!muted),
		setInputDevice: (id) => client.updateMic(id),
		getInputVolume: () => input,
		getOutputVolume: () => output,
	};
}

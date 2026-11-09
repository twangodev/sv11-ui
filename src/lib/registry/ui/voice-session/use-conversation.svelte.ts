import { ConversationSession } from "./session.js";
import type { ConversationAdapter } from "./types.js";

/** External sessions survive control unmounts; locally created sessions are disposed. */
export function useConversation(
	source: () => ConversationSession | ConversationAdapter | undefined
) {
	let session = $state.raw(new ConversationSession());
	let snapshot = $state.raw(session.snapshot);
	$effect(() => {
		const value = source(),
			owned = !(value instanceof ConversationSession);
		const current = value instanceof ConversationSession ? value : new ConversationSession(value);
		session = current;
		const unsubscribe = current.subscribe((next) => (snapshot = next));
		return () => {
			unsubscribe();
			if (owned) void current.dispose();
		};
	});
	return {
		get session() {
			return session;
		},
		get snapshot() {
			return snapshot;
		},
	};
}

/** Owns one microphone capture and releases late permission grants after cancellation. */
export class AudioRecorder {
	#attempt = 0;
	#recorder: MediaRecorder | null = null;
	#stream: MediaStream | null = null;
	#context: AudioContext | null = null;
	#analyser: AnalyserNode | null = null;
	#chunks: Blob[] = [];
	async start(deviceId?: string): Promise<void> {
		this.cancel();
		const id = ++this.#attempt;
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: deviceId ? { deviceId: { exact: deviceId } } : true,
		});
		if (id !== this.#attempt) {
			stream.getTracks().forEach((t) => t.stop());
			throw new DOMException("Recording cancelled", "AbortError");
		}
		this.#stream = stream;
		try {
			const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
				MediaRecorder.isTypeSupported(type)
			);
			const recorder = (this.#recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined
			));
			const chunks: Blob[] = (this.#chunks = []);
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			recorder.start();
			try {
				this.#context = new AudioContext();
				this.#analyser = this.#context.createAnalyser();
				this.#context.createMediaStreamSource(stream).connect(this.#analyser);
			} catch {
				/* Recording remains available if metering is unavailable. */
			}
		} catch (error) {
			this.cancel();
			throw error;
		}
	}
	async stop(): Promise<Blob> {
		const recorder = this.#recorder;
		if (!recorder) {
			this.cancel();
			throw new Error("Recording has not started.");
		}
		const id = this.#attempt,
			chunks = this.#chunks;
		try {
			await new Promise<void>((resolve, reject) => {
				recorder.onstop = () => resolve();
				recorder.onerror = () => reject(new Error("Audio recording failed."));
				if (recorder.state === "inactive") resolve();
				else recorder.stop();
			});
			if (id !== this.#attempt) throw new DOMException("Recording cancelled", "AbortError");
			return new Blob(chunks, { type: recorder.mimeType });
		} finally {
			if (this.#recorder === recorder) this.#release();
		}
	}
	#release() {
		this.#stream?.getTracks().forEach((track) => track.stop());
		this.#stream = null;
		void this.#context?.close().catch(() => {});
		this.#context = null;
		this.#analyser = null;
		this.#recorder = null;
	}
	cancel() {
		++this.#attempt;
		if (this.#recorder?.state === "recording") this.#recorder.stop();
		this.#release();
		this.#chunks = [];
	}
	getLevel = () => {
		if (!this.#analyser) return 0;
		const data = new Uint8Array(this.#analyser.frequencyBinCount);
		this.#analyser.getByteFrequencyData(data);
		return data.reduce((sum, value) => sum + value, 0) / data.length / 255;
	};
}

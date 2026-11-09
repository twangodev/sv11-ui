type Capture = {
	recorder: MediaRecorder;
	stream: MediaStream | null;
	context: AudioContext | null;
	analyser: AnalyserNode | null;
	chunks: Blob[];
	stopped: Promise<void>;
	stopping?: Promise<Blob>;
	error?: Error;
};

/** Owns one microphone capture and releases late permission grants after cancellation. */
export class AudioRecorder {
	#attempt = 0;
	#capture: Capture | null = null;

	async start(deviceId?: string): Promise<void> {
		this.cancel();
		const attempt = ++this.#attempt;
		const stream = await navigator.mediaDevices.getUserMedia({
			audio: deviceId ? { deviceId: { exact: deviceId } } : true,
		});
		if (attempt !== this.#attempt) {
			stream.getTracks().forEach((track) => track.stop());
			throw new DOMException("Recording cancelled", "AbortError");
		}
		let capture: Capture | undefined;
		try {
			const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((type) =>
				MediaRecorder.isTypeSupported(type)
			);
			const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			let stopped!: () => void;
			capture = {
				recorder,
				stream,
				context: null,
				analyser: null,
				chunks: [],
				stopped: new Promise<void>((resolve) => (stopped = resolve)),
			};
			const current = (this.#capture = capture);
			recorder.ondataavailable = (event) => {
				if (event.data.size) current.chunks.push(event.data);
			};
			recorder.onerror = () => {
				current.error = new Error("Audio recording failed.");
			};
			recorder.onstop = stopped;
			recorder.start();
			try {
				current.context = new AudioContext();
				current.analyser = current.context.createAnalyser();
				current.context.createMediaStreamSource(stream).connect(current.analyser);
			} catch {
				/* Recording remains available if metering is unavailable. */
			}
		} catch (error) {
			if (capture) this.cancel();
			else stream.getTracks().forEach((track) => track.stop());
			throw error;
		}
	}

	/** Concurrent callers share completion after the recorder's final data and stop events. */
	stop(): Promise<Blob> {
		const capture = this.#capture;
		if (!capture) {
			this.cancel();
			return Promise.reject(new Error("Recording has not started."));
		}
		if (capture.stopping) return capture.stopping;
		const attempt = this.#attempt;
		capture.stopping = (async () => {
			try {
				if (capture.recorder.state !== "inactive") capture.recorder.stop();
				await capture.stopped;
				if (attempt !== this.#attempt) throw new DOMException("Recording cancelled", "AbortError");
				if (capture.error) throw capture.error;
				return new Blob(capture.chunks, { type: capture.recorder.mimeType });
			} finally {
				if (this.#capture === capture) this.#capture = null;
				this.#release(capture);
			}
		})();
		return capture.stopping;
	}

	#release(capture: Capture) {
		capture.stream?.getTracks().forEach((track) => track.stop());
		capture.stream = null;
		void capture.context?.close().catch(() => {});
		capture.context = null;
		capture.analyser = null;
	}

	cancel() {
		++this.#attempt;
		const capture = this.#capture;
		this.#capture = null;
		if (!capture) return;
		try {
			if (capture.recorder.state !== "inactive") capture.recorder.stop();
		} catch {
			/* Track cleanup still releases an already-ended recording. */
		}
		this.#release(capture);
	}

	getLevel = () => {
		const analyser = this.#capture?.analyser;
		if (!analyser) return 0;
		const data = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(data);
		return data.reduce((sum, value) => sum + value, 0) / data.length / 255;
	};
}

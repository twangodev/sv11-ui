export type AudioDevice = {
	deviceId: string;
	label: string;
	groupId: string;
};

function mapAudioInputs(deviceList: MediaDeviceInfo[]): AudioDevice[] {
	return deviceList
		.filter((device) => device.kind === "audioinput")
		.map((device) => {
			let cleanLabel = device.label || `Microphone ${device.deviceId.slice(0, 8)}`;
			cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, "").trim();
			return {
				deviceId: device.deviceId,
				label: cleanLabel,
				groupId: device.groupId,
			};
		});
}

/**
 * Enumerates available audio input devices and re-enumerates on
 * `devicechange` events. Must be called from a component's script
 * setup phase — effects attach to the calling component's scope.
 */
export function useAudioDevices() {
	let devices = $state<AudioDevice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let hasPermission = $state(false);

	async function loadDevicesWithoutPermission() {
		try {
			loading = true;
			error = null;
			const deviceList = await navigator.mediaDevices.enumerateDevices();
			devices = mapAudioInputs(deviceList);
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to get audio devices";
			console.error("Error getting audio devices:", err);
		} finally {
			loading = false;
		}
	}

	async function loadDevicesWithPermission() {
		if (loading) return;
		try {
			loading = true;
			error = null;
			const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			tempStream.getTracks().forEach((track) => track.stop());
			const deviceList = await navigator.mediaDevices.enumerateDevices();
			devices = mapAudioInputs(deviceList);
			hasPermission = true;
		} catch (err) {
			error = err instanceof Error ? err.message : "Failed to get audio devices";
			console.error("Error getting audio devices:", err);
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadDevicesWithoutPermission();
	});

	$effect(() => {
		const handleDeviceChange = () => {
			if (hasPermission) {
				loadDevicesWithPermission();
			} else {
				loadDevicesWithoutPermission();
			}
		};
		navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
		return () => {
			navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
		};
	});

	return {
		get devices() {
			return devices;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get hasPermission() {
			return hasPermission;
		},
		loadDevices: loadDevicesWithPermission,
	};
}

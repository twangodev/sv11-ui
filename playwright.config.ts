import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/browser",
	fullyParallel: true,
	workers: process.env.CI ? 2 : undefined,
	use: {
		baseURL: "http://127.0.0.1:4174",
		permissions: ["microphone"],
		launchOptions: {
			executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
			args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
		},
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "desktop", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile", use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" } },
	],
	webServer: {
		command:
			"pnpm exec vite build --config tests/browser/vite.config.ts && pnpm exec vite preview --config tests/browser/vite.config.ts",
		url: "http://127.0.0.1:4174",
		timeout: 60000,
		reuseExistingServer: false,
	},
});

import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ page }) => {
	await page.route("**/*perlin-noise.png", (route) =>
		route.fulfill({ contentType: "image/png", body: readFileSync("static/orbs/perlin-noise.png") })
	);
	await page.route("https://elevenlabs.io/docs", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<!doctype html><h1>Documentation preview</h1>",
		})
	);
	await page.route("**/audio/transcript-viewer.wav", (route) =>
		route.fulfill({
			contentType: "audio/wav",
			body: readFileSync("static/audio/transcript-viewer.wav"),
		})
	);
});

test("voice picker opens a styled, usable list", async ({ page }) => {
	await page.goto("/?scenario=visual&component=voice-picker&theme=light");
	await page.getByRole("combobox").click();
	await expect(page.getByRole("option", { name: /Rachel/ })).toBeVisible();
	await page.getByPlaceholder("Search voices...").fill("Drew");
	await expect(page.getByRole("option", { name: /Drew/ })).toBeVisible();
	await expect(page.getByRole("option", { name: /Rachel/ })).toHaveCount(0);
	const popup = page.locator('[data-slot="popover-content"]');
	await expect(popup).toHaveCSS("border-top-width", "1px");
	await expect(popup).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("microphone menu opens with its device and mute controls", async ({ page }) => {
	await page.goto("/?scenario=visual&component=mic-selector&theme=dark");
	await page.getByTestId("visual-stage").getByRole("button").click();
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	await expect(menu.getByRole("button", { name: "Mute", exact: true })).toBeVisible();
	await expect(menu).toHaveCSS("border-top-width", "1px");
	await expect(menu).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
	await expect.poll(() => menu.getByRole("menuitem").count()).toBeGreaterThan(0);
});

test("Pong keeps its restored board layout playable", async ({ page }) => {
	await page.goto("/?scenario=visual&component=block-pong-01&theme=light");
	const board = page.getByRole("group", { name: "Pong game", exact: true });
	await expect(board.getByRole("img", { name: "Pong game field" })).toBeVisible();
	await page.getByRole("button", { name: "Start game" }).click();
	await expect(board).toBeFocused();
	await expect(board.getByText("Move", { exact: false })).toBeVisible();
	await page.keyboard.press("p");
	await expect(board.getByText("PAUSED", { exact: false })).toBeVisible();
	await page.keyboard.press("p");
	await expect(board.getByText("Move", { exact: false })).toBeVisible();
});

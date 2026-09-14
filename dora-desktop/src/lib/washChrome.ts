import type { ThemeMode, WatercolorThemeId } from '@menzies-mariesta-com/menzies-design-wash-ui/core';

/** Persist Wash mode/pigment for Rust site-window chrome (background bleed). */
export async function syncWashChromeToNative(
	mode: ThemeMode,
	pigment: WatercolorThemeId
): Promise<void> {
	if (typeof window === 'undefined') return;
	if (!('__TAURI_INTERNALS__' in window)) return;
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		await invoke('wb_set_wash_chrome', { mode, pigment });
	} catch {
		// Non-Tauri or older binary: ignore.
	}
}

import { browser } from '$app/environment';
import {
	applyTheme,
	initWash,
	isThemeMode,
	isWatercolorTheme,
	readStoredMode,
	readStoredTheme,
	watercolorThemes,
	type ThemeMode,
	type WatercolorThemeId
} from '@menzies-mariesta-com/menzies-design-wash-ui/core';

type WashHandle = ReturnType<typeof initWash>;

const DEFAULT_PIGMENT: WatercolorThemeId = 'mineral';
const DEFAULT_MODE: ThemeMode = 'light';

/**
 * Sole theme authority: Wash pigments + light/dark.
 * Do not set stock daisyUI data-theme values (cupcake, sunset, …).
 */
export class WashThemeTool {
	private wash: WashHandle | undefined;

	boot(options?: { defaultPigment?: WatercolorThemeId; defaultMode?: ThemeMode }): void {
		if (!browser) return;
		const defaultPigment = options?.defaultPigment ?? DEFAULT_PIGMENT;
		const defaultMode = options?.defaultMode ?? DEFAULT_MODE;
		this.wash = initWash({
			defaultPigment,
			defaultMode
		});
		this.apply(this.getPigment(), this.getMode());
	}

	destroy(): void {
		this.wash?.destroy();
		this.wash = undefined;
	}

	getPigment(): WatercolorThemeId {
		const stored = readStoredTheme();
		if (isWatercolorTheme(stored)) return stored;
		return DEFAULT_PIGMENT;
	}

	getMode(): ThemeMode {
		const stored = readStoredMode();
		if (isThemeMode(stored)) return stored;
		return DEFAULT_MODE;
	}

	apply(pigment: WatercolorThemeId, mode: ThemeMode): void {
		if (!browser) return;
		applyTheme(pigment, mode);
	}

	setPigment(pigment: WatercolorThemeId): void {
		this.apply(pigment, this.getMode());
	}

	setMode(mode: ThemeMode): void {
		this.apply(this.getPigment(), mode);
	}

	listPigments(): typeof watercolorThemes {
		return watercolorThemes;
	}
}

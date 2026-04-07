const BROWSER_WINDOW_LABEL = 'browser';

/**
 * Opens (or reuses) a dedicated Tauri WebviewWindow for browsing.
 *
 * Note: This is intentionally client-only; it no-ops during SSR.
 */
export async function openOrReuseBrowserWindow(url: string, title?: string) {
	if (typeof window === 'undefined') return;

	// Dynamic import keeps SSR safe and avoids bundling issues outside Tauri.
	let WebviewWindow: typeof import('@tauri-apps/api/webviewWindow').WebviewWindow;
	try {
		({ WebviewWindow } = await import('@tauri-apps/api/webviewWindow'));
	} catch {
		throw new Error('Tauri API not available (are you running in the Tauri app window?)');
	}

	// Tauri v2: `getByLabel` is async (IPC-backed).
	const existing = await WebviewWindow.getByLabel(BROWSER_WINDOW_LABEL);
	if (existing) {
		// Tauri APIs differ across versions; prefer navigate when available.
		const anyExisting = existing as unknown as {
			navigate?: (url: string) => Promise<void>;
			setUrl?: (url: string) => Promise<void>;
			setTitle?: (title: string) => Promise<void>;
			show: () => Promise<void>;
			setFocus: () => Promise<void>;
		};

		if (typeof anyExisting.navigate === 'function') {
			await anyExisting.navigate(url);
		} else if (typeof anyExisting.setUrl === 'function') {
			await anyExisting.setUrl(url);
		} else {
			// If we can't navigate the existing window, fall back to opening a new one.
			// (Shouldn't happen on supported Tauri versions.)
			const win = new WebviewWindow(BROWSER_WINDOW_LABEL, {
				url,
				title: 'Browser',
				width: 1100,
				height: 800,
				resizable: true,
				visible: true,
				focus: true
			});
			win.once('tauri://error', (e: unknown) => {
				// eslint-disable-next-line no-console
				console.error('Browser window error', e);
			});
			return;
		}

		if (title && typeof anyExisting.setTitle === 'function') {
			await anyExisting.setTitle(title);
		}

		await anyExisting.show();
		await anyExisting.setFocus();
		return;
	}

	const win = new WebviewWindow(BROWSER_WINDOW_LABEL, {
		url,
		title: title ?? 'Whitelist Browser',
		width: 1100,
		height: 800,
		resizable: true,
		visible: true,
		focus: true
	});

	// Avoid unhandled promise rejections if the window fails to create.
	win.once('tauri://error', (e: unknown) => {
		// eslint-disable-next-line no-console
		console.error('Browser window error', e);
	});
}


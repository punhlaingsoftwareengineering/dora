export type StoredConnection = {
	orgId: string;
	deviceId: string;
};

export type StoredConfig = {
	proxy: { host: string; port: number } | null;
	sites: { id: string; label: string; urlPattern: string }[];
};

const KEY_CONN = 'wb.connection';
const KEY_CFG = 'wb.config';
const KEY_FINGERPRINT = 'wb.fingerprint';

function hasLocalStorage() {
	try {
		return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
	} catch {
		return false;
	}
}

export function getOrCreateFingerprint() {
	if (!hasLocalStorage()) return `fp_${crypto.randomUUID()}`;
	const existing = localStorage.getItem(KEY_FINGERPRINT);
	if (existing) return existing;
	const fp = `fp_${crypto.randomUUID()}`;
	localStorage.setItem(KEY_FINGERPRINT, fp);
	return fp;
}

export function loadConnection(): StoredConnection | null {
	if (!hasLocalStorage()) return null;
	const raw = localStorage.getItem(KEY_CONN);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredConnection;
	} catch {
		return null;
	}
}

export function saveConnection(conn: StoredConnection) {
	if (!hasLocalStorage()) return;
	localStorage.setItem(KEY_CONN, JSON.stringify(conn));
}

export function clearConnection() {
	if (!hasLocalStorage()) return;
	localStorage.removeItem(KEY_CONN);
	localStorage.removeItem(KEY_CFG);
}

export function loadConfig(): StoredConfig | null {
	if (!hasLocalStorage()) return null;
	const raw = localStorage.getItem(KEY_CFG);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as StoredConfig;
	} catch {
		return null;
	}
}

export function saveConfig(cfg: StoredConfig) {
	if (!hasLocalStorage()) return;
	localStorage.setItem(KEY_CFG, JSON.stringify(cfg));
}


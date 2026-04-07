export const SERVER_ORIGIN = import.meta.env.VITE_SERVER_ORIGIN ?? 'http://localhost:5173';

export async function postConnect(payload: unknown) {
	const res = await fetch(`${SERVER_ORIGIN}/api/device/connect`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const json = await res.json();
	if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Connect failed');
	return json as { ok: true; requestId: string; orgId: string };
}

export async function getRequestStatus(requestId: string) {
	const res = await fetch(`${SERVER_ORIGIN}/api/device/requests/status?requestId=${encodeURIComponent(requestId)}`);
	const json = await res.json();
	if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Status failed');
	return json as {
		ok: true;
		status: string;
		orgId?: string;
		deviceId?: string;
		proxy?: { host: string; port: number } | null;
		sites?: { id: string; label: string; urlPattern: string }[];
	};
}

export async function getDeviceOptions(orgId: string, deviceId: string) {
	const res = await fetch(
		`${SERVER_ORIGIN}/api/device/options?orgId=${encodeURIComponent(orgId)}&deviceId=${encodeURIComponent(deviceId)}`
	);
	const json = await res.json();
	if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Options failed');
	return json as {
		ok: true;
		status?: string;
		proxy: { host: string; port: number } | null;
		sites: { id: string; label: string; urlPattern: string }[];
	};
}

export async function getDeviceOptionsWithTimeout(
	orgId: string,
	deviceId: string,
	timeoutMs = 2500
) {
	const controller = new AbortController();
	const t = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(
			`${SERVER_ORIGIN}/api/device/options?orgId=${encodeURIComponent(orgId)}&deviceId=${encodeURIComponent(deviceId)}`,
			{ signal: controller.signal }
		);
		const json = await res.json();
		if (!res.ok || !json.ok) throw new Error(json?.error?.message ?? 'Options failed');
		return json as {
			ok: true;
			status?: string;
			proxy: { host: string; port: number } | null;
			sites: { id: string; label: string; urlPattern: string }[];
		};
	} finally {
		clearTimeout(t);
	}
}


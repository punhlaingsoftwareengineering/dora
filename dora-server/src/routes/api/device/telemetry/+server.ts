import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZDeviceTelemetryInput } from '$lib/shared/zod/device_telemetry';
import { db } from '$lib/server/db';
import { main_device, main_device_event } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { hub } from '$lib/server/ws/hub';

/** Insert a telemetry history row at most this often when nothing else changed. */
const TELEMETRY_SAMPLE_MS = 5 * 60 * 1000;

type SampleStore = Map<string, number>;
const g = globalThis as typeof globalThis & { __doraTelemetrySample?: SampleStore };
function sampleStore(): SampleStore {
	if (!g.__doraTelemetrySample) g.__doraTelemetrySample = new Map();
	return g.__doraTelemetrySample;
}

function getIp(req: Request) {
	return (
		req.headers.get('cf-connecting-ip') ??
		req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
		req.headers.get('x-real-ip') ??
		null
	);
}

export const POST: RequestHandler = async (event) => {
	const body = await event.request.json().catch(() => null);
	let input: (typeof ZDeviceTelemetryInput)['_output'];
	try {
		input = parseOrThrow(ZDeviceTelemetryInput, body);
	} catch (e) {
		return jsonError(400, e instanceof Error ? e.message : 'Invalid payload');
	}

	const device = await db.query.main_device.findFirst({
		where: and(eq(main_device.id, input.deviceId), eq(main_device.orgId, input.orgId))
	});
	if (!device) return jsonError(404, 'Device not found');

	const ip = getIp(event.request);
	const now = new Date();
	const currentUrl = input.currentUrl ?? null;
	const appVersion = input.spec.appVersion ?? null;

	await db
		.update(main_device)
		.set({
			lastSeenAt: now,
			lastIp: ip,
			lastLocation: input.location,
			lastSpec: input.spec,
			lastAppVersion: appVersion ?? device.lastAppVersion,
			lastCurrentUrl: currentUrl ?? device.lastCurrentUrl
		})
		.where(eq(main_device.id, input.deviceId));

	const urlChanged = currentUrl !== (device.lastCurrentUrl ?? null);
	const versionChanged = appVersion != null && appVersion !== device.lastAppVersion;
	const samples = sampleStore();
	const lastSample = samples.get(input.deviceId) ?? 0;
	const dueForSample = now.getTime() - lastSample >= TELEMETRY_SAMPLE_MS;

	if (urlChanged || versionChanged || dueForSample) {
		await db.insert(main_device_event).values({
			deviceId: input.deviceId,
			eventType: 'telemetry',
			payload: {
				currentUrl,
				spec: input.spec,
				location: input.location,
				ip
			}
		});
		samples.set(input.deviceId, now.getTime());
	}

	hub.emitDevice(input.deviceId, {
		type: 'telemetry',
		deviceId: input.deviceId,
		orgId: input.orgId,
		at: now.toISOString(),
		currentUrl,
		spec: input.spec,
		location: input.location,
		ip
	});

	return jsonOk({ ok: true });
};

import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZDeviceEnabledInput, ZDeviceRenameInput } from '$lib/shared/zod/device';
import {
	forceRefreshDevice,
	getDeviceDetail,
	renameDevice,
	setDeviceEnabled
} from '$lib/server/remote/main/device';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const detail = await getDeviceDetail(event.locals.user, event.params.id, event.params.deviceId);
	if (!detail) return jsonError(404, 'Not found');
	return jsonOk({ ok: true, ...detail });
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);

	if (body && typeof body === 'object' && 'deviceName' in body) {
		const input = parseOrThrow(ZDeviceRenameInput, body);
		const device = await renameDevice(event.locals.user, {
			orgId: event.params.id,
			deviceId: event.params.deviceId,
			deviceName: input.deviceName
		});
		if (!device) return jsonError(404, 'Not found');
		return jsonOk({ ok: true, device });
	}

	if (body && typeof body === 'object' && 'enabled' in body) {
		const input = parseOrThrow(ZDeviceEnabledInput, body);
		const device = await setDeviceEnabled(event.locals.user, {
			orgId: event.params.id,
			deviceId: event.params.deviceId,
			enabled: input.enabled
		});
		if (!device) return jsonError(404, 'Not found');
		return jsonOk({ ok: true, device });
	}

	if (body && typeof body === 'object' && (body as { action?: string }).action === 'force_refresh') {
		const result = await forceRefreshDevice(
			event.locals.user,
			event.params.id,
			event.params.deviceId
		);
		if (!result) return jsonError(404, 'Not found');
		return jsonOk({ ok: true, ...result });
	}

	return jsonError(400, 'Unknown action');
};

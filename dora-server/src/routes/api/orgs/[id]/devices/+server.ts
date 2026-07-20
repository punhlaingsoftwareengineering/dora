import type { RequestHandler } from './$types';
import { jsonError, jsonOk } from '$lib/shared/zod/_helpers';
import { listDevices } from '$lib/server/remote/main/device';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const devices = await listDevices(event.locals.user, event.params.id);
	if (!devices) return jsonError(404, 'Not found');
	return jsonOk({ ok: true, devices });
};

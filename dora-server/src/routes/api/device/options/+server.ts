import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZDeviceOptionsInput } from '$lib/shared/zod/device';
import { db } from '$lib/server/db';
import {
	main_device,
	main_device_request,
	main_org,
	main_org_proxy,
	main_org_site
} from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getMasterStatusCode } from '$lib/server/status';

export const OPTIONS: RequestHandler = async () =>
	new Response(null, {
		status: 204,
		headers: {
			'access-control-allow-origin': '*',
			'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
			'access-control-allow-headers': 'content-type, authorization'
		}
	});

export const GET: RequestHandler = async (event) => {
	const orgId = event.url.searchParams.get('orgId');
	const deviceId = event.url.searchParams.get('deviceId');
	const input = parseOrThrow(ZDeviceOptionsInput, { orgId, deviceId });

	const [device, org] = await Promise.all([
		db.query.main_device.findFirst({
			where: and(eq(main_device.id, input.deviceId), eq(main_device.orgId, input.orgId)),
			columns: {
				id: true,
				orgId: true,
				deviceFingerprint: true,
				masterStatusId: true
			}
		}),
		db.query.main_org.findFirst({
			where: eq(main_org.id, input.orgId),
			columns: { id: true, configVersion: true }
		})
	]);
	if (!device) return jsonError(404, 'Device not found');

	const configVersion = org?.configVersion ?? 1;
	const deviceStatusCode = await getMasterStatusCode(device.masterStatusId);
	if (deviceStatusCode === 'DISABLED' || deviceStatusCode === 'DELETED') {
		return jsonOk({
			ok: true,
			status: 'DISABLED',
			configVersion,
			proxy: null,
			sites: []
		});
	}

	const req = await db.query.main_device_request.findFirst({
		where: and(
			eq(main_device_request.orgId, input.orgId),
			eq(main_device_request.deviceFingerprint, device.deviceFingerprint)
		),
		columns: { requestStatusId: true },
		orderBy: (t, { desc }) => [desc(t.requestedAt)]
	});
	if (req) {
		const code = (await getMasterStatusCode(req.requestStatusId)) ?? 'PENDING';
		if (code === 'REJECTED' || code === 'IGNORED') {
			return jsonOk({
				ok: true,
				status: code,
				configVersion,
				proxy: null,
				sites: []
			});
		}
	}

	const [proxy, sites] = await Promise.all([
		db.query.main_org_proxy.findFirst({
			where: eq(main_org_proxy.orgId, input.orgId),
			columns: { host: true, port: true }
		}),
		db.query.main_org_site.findMany({
			where: eq(main_org_site.orgId, input.orgId),
			columns: { id: true, label: true, urlPattern: true }
		})
	]);

	return jsonOk({
		ok: true,
		status: 'APPROVED',
		configVersion,
		proxy: proxy ? { host: proxy.host, port: proxy.port } : null,
		sites: sites.map((s) => ({ id: s.id, label: s.label, urlPattern: s.urlPattern }))
	});
};

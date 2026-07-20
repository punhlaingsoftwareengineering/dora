import type { RequestHandler } from './$types';
import { jsonError, jsonOk } from '$lib/shared/zod/_helpers';
import { db } from '$lib/server/db';
import { main_device_request, master_status } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { requireOrgRole } from '$lib/server/org_access';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');

	const access = await requireOrgRole(event.locals.user.id, event.params.id, 'member');
	if (!access) return jsonError(404, 'Not found');

	const rows = await db.query.main_device_request.findMany({
		where: eq(main_device_request.orgId, event.params.id),
		orderBy: desc(main_device_request.requestedAt)
	});

	const uniqueStatusIds = Array.from(new Set(rows.map((r) => r.requestStatusId)));
	const statusById = new Map<string, string>();
	if (uniqueStatusIds.length > 0) {
		const statuses = await db
			.select()
			.from(master_status)
			.where(inArray(master_status.id, uniqueStatusIds));
		for (const s of statuses) statusById.set(s.id, s.code);
	}

	return jsonOk({
		ok: true,
		requests: rows.map((r) => ({
			id: r.id,
			deviceFingerprint: r.deviceFingerprint,
			devicePublicInfo: r.devicePublicInfo,
			requestedAt: r.requestedAt,
			status: statusById.get(r.requestStatusId) ?? 'PENDING',
			deviceName: r.deviceName
		}))
	});
};

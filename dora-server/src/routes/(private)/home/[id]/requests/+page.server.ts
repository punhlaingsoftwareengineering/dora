import type { PageServerLoad } from './$types';
import { requireOrgRole } from '$lib/server/org_access';
import { redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { main_device_request, master_status } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const access = await requireOrgRole(event.locals.user!.id, event.params.id, 'member');
	if (!access) return { requests: [] };
	if (access.role !== 'owner' && access.role !== 'admin') {
		redirect(303, `/home/${event.params.id}`);
	}

	const rows = await db.query.main_device_request.findMany({
		where: eq(main_device_request.orgId, event.params.id),
		orderBy: desc(main_device_request.requestedAt)
	});

	const statusById = new Map<string, string>();
	const ids = Array.from(new Set(rows.map((r) => r.requestStatusId)));
	if (ids.length > 0) {
		const statuses = await db.select().from(master_status).where(inArray(master_status.id, ids));
		for (const s of statuses) statusById.set(s.id, s.code);
	}

	return {
		requests: rows.map((r) => ({
			id: r.id,
			deviceFingerprint: r.deviceFingerprint,
			devicePublicInfo: r.devicePublicInfo as Record<string, unknown>,
			requestedAt: r.requestedAt.toISOString(),
			status: statusById.get(r.requestStatusId) ?? 'PENDING',
			deviceName: r.deviceName
		}))
	};
};

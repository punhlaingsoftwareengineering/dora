import type { LayoutServerLoad } from './$types';
import { requireOrgRole } from '$lib/server/org_access';
import { db } from '$lib/server/db';
import { main_device_request } from '$lib/server/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';

export const load: LayoutServerLoad = async (event) => {
	const access = await requireOrgRole(event.locals.user!.id, event.params.id, 'member');
	if (!access) {
		return { org: null, role: null, pendingCount: 0 };
	}

	const canManage = access.role === 'owner' || access.role === 'admin';
	let pendingCount = 0;
	if (canManage) {
		const pendingId = await getMasterStatusId('PENDING');
		const [row] = await db
			.select({ n: count() })
			.from(main_device_request)
			.where(
				and(
					eq(main_device_request.orgId, event.params.id),
					eq(main_device_request.requestStatusId, pendingId)
				)
			);
		pendingCount = Number(row?.n ?? 0);
	}

	return {
		org: access.org,
		role: access.role,
		pendingCount
	};
};

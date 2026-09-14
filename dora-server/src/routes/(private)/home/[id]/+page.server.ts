import type { PageServerLoad } from './$types';
import { getOrgDetail } from '$lib/server/remote/main/org_detail';
import { listDevicesForOrg } from '$lib/server/remote/main/device';
import { listMembersWithUsers } from '$lib/server/org_access';
import { listPendingInvitesForOrg } from '$lib/server/remote/main/member';
import { db } from '$lib/server/db';
import { main_device_request, master_status } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const detail = await getOrgDetail(event.locals.user!, event.params.id);
	if (!detail) {
		return {
			org: null,
			role: null,
			activeSecret: null,
			proxy: null,
			sites: [],
			requests: [],
			devices: [],
			members: [],
			invites: []
		};
	}

	const orgId = event.params.id;
	const canManage = detail.role === 'owner' || detail.role === 'admin';

	const [rows, devices, members, invites] = await Promise.all([
		canManage
			? db.query.main_device_request.findMany({
					where: eq(main_device_request.orgId, orgId),
					orderBy: desc(main_device_request.requestedAt),
					limit: 20
				})
			: Promise.resolve([]),
		listDevicesForOrg(orgId),
		listMembersWithUsers(orgId),
		canManage ? listPendingInvitesForOrg(orgId) : Promise.resolve([])
	]);

	const statusById = new Map<string, string>();
	const ids = Array.from(new Set(rows.map((r) => r.requestStatusId)));
	if (ids.length > 0) {
		const statuses = await db.select().from(master_status).where(inArray(master_status.id, ids));
		for (const s of statuses) statusById.set(s.id, s.code);
	}

	return {
		...detail,
		requests: rows.map((r) => ({
			id: r.id,
			deviceFingerprint: r.deviceFingerprint,
			requestedAt: r.requestedAt.toISOString(),
			status: statusById.get(r.requestStatusId) ?? 'PENDING',
			deviceName: r.deviceName
		})),
		devices: devices.map((d) => ({
			id: d.id,
			deviceName: d.deviceName,
			online: d.online,
			freshness: d.freshness,
			lastSeenAt: d.lastSeenAt?.toISOString?.() ?? d.lastSeenAt,
			statusCode: d.statusCode
		})),
		members,
		invites: invites.map((i) => ({
			id: i.id,
			email: i.email,
			role: i.role,
			expiresAt: i.expiresAt.toISOString(),
			createdAt: i.createdAt.toISOString()
		}))
	};
};

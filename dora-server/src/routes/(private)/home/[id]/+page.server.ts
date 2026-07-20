import type { PageServerLoad } from './$types';
import { getOrgDetail } from '$lib/server/remote/main/org_detail';
import { listDevices } from '$lib/server/remote/main/device';
import { listInvites, listMembers } from '$lib/server/remote/main/member';
import { db } from '$lib/server/db';
import { main_device_request, master_status } from '$lib/server/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';

export const load: PageServerLoad = async (event) => {
	const detail = await getOrgDetail(event.locals.user!, event.params.id);
	if (!detail) {
		return {
			org: null,
			role: null,
			proxy: null,
			sites: [],
			activeSecret: null,
			requests: [],
			devices: [],
			members: [],
			invites: []
		};
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

	const devices = (await listDevices(event.locals.user!, event.params.id)) ?? [];
	const members = (await listMembers(event.locals.user!, event.params.id)) ?? [];
	const invites =
		detail.role === 'owner' || detail.role === 'admin'
			? ((await listInvites(event.locals.user!, event.params.id)) ?? [])
			: [];

	return {
		...detail,
		requests: rows.map((r) => ({
			id: r.id,
			deviceFingerprint: r.deviceFingerprint,
			devicePublicInfo: r.devicePublicInfo as Record<string, unknown>,
			requestedAt: r.requestedAt.toISOString(),
			status: statusById.get(r.requestStatusId) ?? 'PENDING',
			deviceName: r.deviceName
		})),
		devices: devices.map((d) => ({
			id: d.id,
			deviceName: d.deviceName,
			online: d.online,
			freshness: d.freshness,
			lastCurrentUrl: d.lastCurrentUrl,
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

import { db } from '$lib/server/db';
import { main_device, main_device_event, master_status } from '$lib/server/db/schema';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import {
	bumpOrgConfigVersion,
	isOnline,
	relativeFreshness,
	requireOrgRole,
	type AuthedUser
} from '$lib/server/org_access';

function mapDevice(d: typeof main_device.$inferSelect, statusCode?: string) {
	const spec = (d.lastSpec ?? {}) as Record<string, unknown>;
	return {
		...d,
		lastSpec: spec,
		username: typeof spec.username === 'string' ? spec.username : null,
		hostname: typeof spec.hostname === 'string' ? spec.hostname : null,
		os: typeof spec.os === 'string' ? spec.os : null,
		online: isOnline(d.lastSeenAt),
		freshness: relativeFreshness(d.lastSeenAt),
		statusCode: statusCode ?? 'ACTIVE'
	};
}

export async function listDevices(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'member');
	if (!access) return null;

	const devices = await db.query.main_device.findMany({
		where: eq(main_device.orgId, orgId),
		orderBy: desc(main_device.updatedAt)
	});

	const statusIds = [...new Set(devices.map((d) => d.masterStatusId))];
	const statusMap = new Map<string, string>();
	if (statusIds.length > 0) {
		const rows = await db.select().from(master_status).where(inArray(master_status.id, statusIds));
		for (const row of rows) statusMap.set(row.id, row.code);
	}

	return devices.map((d) => mapDevice(d, statusMap.get(d.masterStatusId)));
}

export async function getDeviceDetail(user: AuthedUser, orgId: string, deviceId: string) {
	const access = await requireOrgRole(user.id, orgId, 'member');
	if (!access) return null;

	const device = await db.query.main_device.findFirst({
		where: and(eq(main_device.id, deviceId), eq(main_device.orgId, orgId))
	});
	if (!device) return null;

	const status = await db.query.master_status.findFirst({
		where: eq(master_status.id, device.masterStatusId)
	});

	const recent = await db.query.main_device_event.findMany({
		where: eq(main_device_event.deviceId, deviceId),
		orderBy: desc(main_device_event.createdAt),
		limit: 100
	});

	const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const dayEvents = await db.query.main_device_event.findMany({
		where: and(eq(main_device_event.deviceId, deviceId), gte(main_device_event.createdAt, since)),
		orderBy: desc(main_device_event.createdAt)
	});

	const byHour = new Array(24).fill(0) as number[];
	for (const e of dayEvents) {
		const h = e.createdAt.getHours();
		byHour[h] += 1;
	}

	const typeCounts: Record<string, number> = {};
	for (const e of dayEvents) {
		typeCounts[e.eventType] = (typeCounts[e.eventType] ?? 0) + 1;
	}

	return {
		device: mapDevice(device, status?.code),
		recent,
		charts: {
			eventsByHour: byHour,
			eventTypeCounts: typeCounts,
			eventCount24h: dayEvents.length
		},
		role: access.role
	};
}

export async function renameDevice(
	user: AuthedUser,
	input: { orgId: string; deviceId: string; deviceName: string }
) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const [row] = await db
		.update(main_device)
		.set({ deviceName: input.deviceName })
		.where(and(eq(main_device.id, input.deviceId), eq(main_device.orgId, input.orgId)))
		.returning();
	return row ?? null;
}

export async function setDeviceEnabled(
	user: AuthedUser,
	input: { orgId: string; deviceId: string; enabled: boolean }
) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const statusId = await getMasterStatusId(input.enabled ? 'ACTIVE' : 'DISABLED');
	const [row] = await db
		.update(main_device)
		.set({ masterStatusId: statusId })
		.where(and(eq(main_device.id, input.deviceId), eq(main_device.orgId, input.orgId)))
		.returning();

	await bumpOrgConfigVersion(input.orgId);

	if (row) {
		await db.insert(main_device_event).values({
			deviceId: input.deviceId,
			eventType: input.enabled ? 'enabled' : 'disabled',
			payload: { byUserId: user.id }
		});
	}

	return row ?? null;
}

export async function forceRefreshDevice(user: AuthedUser, orgId: string, deviceId: string) {
	const access = await requireOrgRole(user.id, orgId, 'admin');
	if (!access) return null;

	const device = await db.query.main_device.findFirst({
		where: and(eq(main_device.id, deviceId), eq(main_device.orgId, orgId))
	});
	if (!device) return null;

	const org = await bumpOrgConfigVersion(orgId);
	await db.insert(main_device_event).values({
		deviceId,
		eventType: 'force_refresh',
		payload: { byUserId: user.id, configVersion: org?.configVersion }
	});

	return { configVersion: org?.configVersion ?? null };
}

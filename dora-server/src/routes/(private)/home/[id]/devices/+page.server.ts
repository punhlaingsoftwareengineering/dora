import type { PageServerLoad } from './$types';
import { listDevices } from '$lib/server/remote/main/device';
import { requireOrgRole } from '$lib/server/org_access';

export const load: PageServerLoad = async (event) => {
	const access = await requireOrgRole(event.locals.user!.id, event.params.id, 'member');
	if (!access) return { devices: [], role: null };

	const devices = (await listDevices(event.locals.user!, event.params.id)) ?? [];
	return {
		role: access.role,
		devices: devices.map((d) => ({
			id: d.id,
			deviceName: d.deviceName,
			deviceFingerprint: d.deviceFingerprint,
			lastSeenAt: d.lastSeenAt?.toISOString?.() ?? (d.lastSeenAt as string | null),
			lastIp: d.lastIp,
			lastAppVersion: d.lastAppVersion,
			lastCurrentUrl: d.lastCurrentUrl,
			online: d.online,
			freshness: d.freshness,
			statusCode: d.statusCode,
			username: d.username,
			hostname: d.hostname,
			os: d.os
		}))
	};
};

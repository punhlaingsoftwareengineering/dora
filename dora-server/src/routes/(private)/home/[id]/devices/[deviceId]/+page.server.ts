import type { PageServerLoad } from './$types';
import { getDeviceDetail } from '$lib/server/remote/main/device';

export const load: PageServerLoad = async (event) => {
	const detail = await getDeviceDetail(
		event.locals.user!,
		event.params.id,
		event.params.deviceId
	);
	if (!detail) return { device: null, recent: [], charts: null, role: null };

	return {
		role: detail.role,
		device: {
			...detail.device,
			lastSeenAt: detail.device.lastSeenAt?.toISOString?.() ?? detail.device.lastSeenAt,
			createdAt: detail.device.createdAt?.toISOString?.() ?? detail.device.createdAt,
			updatedAt: detail.device.updatedAt?.toISOString?.() ?? detail.device.updatedAt
		},
		recent: detail.recent.map((e) => ({
			id: e.id,
			eventType: e.eventType,
			payload: e.payload,
			createdAt: e.createdAt.toISOString()
		})),
		charts: detail.charts
	};
};

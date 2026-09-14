import type { PageServerLoad } from './$types';
import { getOrgDetail } from '$lib/server/remote/main/org_detail';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const detail = await getOrgDetail(event.locals.user!, event.params.id);
	if (!detail) {
		return { org: null, role: null, proxy: null, sites: [], activeSecret: null };
	}
	if (detail.role !== 'owner' && detail.role !== 'admin') {
		redirect(303, `/home/${event.params.id}`);
	}
	return detail;
};

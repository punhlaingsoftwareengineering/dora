import type { PageServerLoad } from './$types';
import { listMembersWithUsers, requireOrgRole } from '$lib/server/org_access';
import { listPendingInvitesForOrg } from '$lib/server/remote/main/member';

export const load: PageServerLoad = async (event) => {
	const access = await requireOrgRole(event.locals.user!.id, event.params.id, 'member');
	if (!access) return { role: null, members: [], invites: [] };

	const canManage = access.role === 'owner' || access.role === 'admin';
	const [members, invites] = await Promise.all([
		listMembersWithUsers(event.params.id),
		canManage ? listPendingInvitesForOrg(event.params.id) : Promise.resolve([])
	]);

	return {
		role: access.role,
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

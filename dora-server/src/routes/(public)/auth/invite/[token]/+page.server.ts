import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { main_org, main_org_invite, master_status } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { acceptInvite } from '$lib/server/remote/main/member';

export const load: PageServerLoad = async (event) => {
	const token = event.params.token;
	const invite = await db.query.main_org_invite.findFirst({
		where: eq(main_org_invite.token, token)
	});
	if (!invite) throw error(404, 'Invite not found');

	const org = await db.query.main_org.findFirst({ where: eq(main_org.id, invite.orgId) });
	const status = await db.query.master_status.findFirst({
		where: eq(master_status.id, invite.masterStatusId)
	});

	return {
		token,
		email: invite.email,
		role: invite.role,
		orgName: org?.name ?? 'Organization',
		status: status?.code ?? 'PENDING',
		expired: invite.expiresAt.getTime() < Date.now(),
		user: event.locals.user
			? { id: event.locals.user.id, email: event.locals.user.email }
			: null
	};
};

export const actions: Actions = {
	accept: async (event) => {
		if (!event.locals.user?.email) {
			return fail(401, { message: 'Sign in required' });
		}
		try {
			const result = await acceptInvite(
				{ id: event.locals.user.id, email: event.locals.user.email },
				event.params.token
			);
			throw redirect(302, `/home/${result.orgId}`);
		} catch (e) {
			if (e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 302) throw e;
			return fail(400, { message: e instanceof Error ? e.message : 'Accept failed' });
		}
	}
};

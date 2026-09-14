import type { Actions, PageServerLoad } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { main_org, main_org_invite, master_status, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { acceptInvite } from '$lib/server/remote/main/member';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

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

	const existing = await db.query.user.findFirst({
		where: eq(user.email, invite.email.toLowerCase())
	});

	return {
		token,
		email: invite.email,
		role: invite.role,
		orgName: org?.name ?? 'Organization',
		status: status?.code ?? 'PENDING',
		expired: invite.expiresAt.getTime() < Date.now(),
		accountExists: Boolean(existing),
		user: event.locals.user
			? { id: event.locals.user.id, email: event.locals.user.email }
			: null
	};
};

function isRedirect(e: unknown): e is { status: number; location?: string } {
	return Boolean(e && typeof e === 'object' && 'status' in e && (e as { status: number }).status === 302);
}

export const actions: Actions = {
	join: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';
		const passwordConfirm = formData.get('passwordConfirm')?.toString() ?? '';

		if (password.length < 8) {
			return fail(400, { message: 'Password must be at least 8 characters' });
		}
		if (password !== passwordConfirm) {
			return fail(400, { message: 'Passwords do not match' });
		}

		const invite = await db.query.main_org_invite.findFirst({
			where: eq(main_org_invite.token, event.params.token)
		});
		if (!invite) return fail(404, { message: 'Invite not found' });

		const email = invite.email.trim().toLowerCase();
		const existing = await db.query.user.findFirst({ where: eq(user.email, email) });

		let needsTwoFactor = false;

		try {
			if (!existing) {
				const name = email.split('@')[0] || 'Member';
				await auth.api.signUpEmail({
					body: {
						email,
						password,
						name,
						callbackURL: `/home/${invite.orgId}`
					},
					headers: event.request.headers
				});
			} else {
				const result = await auth.api.signInEmail({
					body: { email, password, callbackURL: `/home/${invite.orgId}` },
					headers: event.request.headers
				});
				if (
					result &&
					typeof result === 'object' &&
					'twoFactorRedirect' in result &&
					(result as { twoFactorRedirect?: boolean }).twoFactorRedirect
				) {
					needsTwoFactor = true;
				}
			}
		} catch (e) {
			const msg = e instanceof APIError ? e.message : '';
			if (msg.toLowerCase().includes('two factor') || msg.toLowerCase().includes('2fa')) {
				needsTwoFactor = true;
			} else if (e instanceof APIError) {
				return fail(400, { message: e.message || 'Could not join' });
			} else {
				return fail(500, { message: 'Unexpected error' });
			}
		}

		const joinedUser = await db.query.user.findFirst({ where: eq(user.email, email) });
		if (!joinedUser) {
			return fail(400, { message: 'Could not create or find account. Try again.' });
		}

		try {
			await acceptInvite({ id: joinedUser.id, email: joinedUser.email }, event.params.token);
		} catch (e) {
			if (isRedirect(e)) throw e;
			return fail(400, { message: e instanceof Error ? e.message : 'Accept failed' });
		}

		if (needsTwoFactor) {
			throw redirect(302, `/auth/two-factor`);
		}

		throw redirect(302, `/home/${invite.orgId}`);
	},

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
			if (isRedirect(e)) throw e;
			return fail(400, { message: e instanceof Error ? e.message : 'Accept failed' });
		}
	}
};

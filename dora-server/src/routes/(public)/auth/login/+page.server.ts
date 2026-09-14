import { fail, isRedirect, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		throw redirect(302, '/home');
	}
	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			const result = await auth.api.signInEmail({
				body: { email, password, callbackURL: '/home' },
				headers: event.request.headers
			});

			if (
				result &&
				typeof result === 'object' &&
				'twoFactorRedirect' in result &&
				(result as { twoFactorRedirect?: boolean }).twoFactorRedirect
			) {
				throw redirect(302, '/auth/two-factor');
			}
		} catch (error) {
			// redirect() throws — must rethrow or login appears to fail
			if (isRedirect(error)) throw error;

			const msg = error instanceof APIError ? error.message : '';
			if (msg.toLowerCase().includes('two factor') || msg.toLowerCase().includes('2fa')) {
				throw redirect(302, '/auth/two-factor');
			}
			if (error instanceof APIError) return fail(400, { message: error.message || 'Signin failed' });
			return fail(500, { message: 'Unexpected error' });
		}

		throw redirect(302, '/home');
	},

	signInSocial: async (event) => {
		const formData = await event.request.formData();
		const provider = formData.get('provider')?.toString() ?? 'github';
		const callbackURL = formData.get('callbackURL')?.toString() ?? '/home';

		try {
			const result = await auth.api.signInSocial({
				body: { provider: provider as 'github', callbackURL }
			});

			if (result.url) throw redirect(302, result.url);
			return fail(400, { message: 'Social sign-in failed' });
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) return fail(400, { message: error.message || 'Social sign-in failed' });
			return fail(500, { message: 'Unexpected error' });
		}
	}
};

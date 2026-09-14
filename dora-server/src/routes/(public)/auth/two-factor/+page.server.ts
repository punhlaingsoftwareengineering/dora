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
	verifyTotp: async (event) => {
		const formData = await event.request.formData();
		const code = formData.get('code')?.toString() ?? '';
		try {
			await auth.api.verifyTOTP({
				body: { code },
				headers: event.request.headers
			});
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) return fail(400, { message: error.message || 'Invalid code' });
			return fail(500, { message: 'Unexpected error' });
		}
		throw redirect(302, '/home');
	},

	verifyBackup: async (event) => {
		const formData = await event.request.formData();
		const code = formData.get('code')?.toString() ?? '';
		try {
			await auth.api.verifyBackupCode({
				body: { code },
				headers: event.request.headers
			});
		} catch (error) {
			if (isRedirect(error)) throw error;
			if (error instanceof APIError) return fail(400, { message: error.message || 'Invalid code' });
			return fail(500, { message: 'Unexpected error' });
		}
		throw redirect(302, '/home');
	}
};

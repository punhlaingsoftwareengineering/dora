import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';

export const load: PageServerLoad = async (event) => {
	const twoFactorEnabled = Boolean(
		(event.locals.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled
	);
	return { twoFactorEnabled, user: event.locals.user };
};

export const actions: Actions = {
	enable: async (event) => {
		const formData = await event.request.formData();
		const password = formData.get('password')?.toString() ?? '';
		try {
			const body: { password?: string; issuer: string } = { issuer: 'Dora' };
			if (password) body.password = password;
			const data = await auth.api.enableTwoFactor({
				body: body as { password: string; issuer: string },
				headers: event.request.headers
			});
			return {
				totpURI: (data as { totpURI?: string }).totpURI ?? null,
				backupCodes: (data as { backupCodes?: string[] }).backupCodes ?? []
			};
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message || 'Enable failed' });
			return fail(500, { message: 'Unexpected error' });
		}
	},

	verifyTotp: async (event) => {
		const formData = await event.request.formData();
		const code = formData.get('code')?.toString() ?? '';
		try {
			await auth.api.verifyTOTP({
				body: { code },
				headers: event.request.headers
			});
			return { verified: true };
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: error.message || 'Invalid code' });
			return fail(500, { message: 'Unexpected error' });
		}
	}
};

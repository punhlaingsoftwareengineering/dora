import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import QRCode from 'qrcode';

export const load: PageServerLoad = async (event) => {
	const twoFactorEnabled = Boolean(
		(event.locals.user as { twoFactorEnabled?: boolean | null } | undefined)?.twoFactorEnabled
	);
	return { twoFactorEnabled, user: event.locals.user };
};

function secretFromTotpUri(uri: string | null | undefined) {
	if (!uri) return null;
	try {
		const u = new URL(uri);
		return u.searchParams.get('secret');
	} catch {
		return null;
	}
}

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
			const totpURI = (data as { totpURI?: string }).totpURI ?? null;
			const qrDataUrl = totpURI
				? await QRCode.toDataURL(totpURI, {
						errorCorrectionLevel: 'M',
						margin: 2,
						width: 240,
						color: { dark: '#000000', light: '#ffffff' }
					})
				: null;

			return {
				totpURI,
				qrDataUrl,
				manualSecret: secretFromTotpUri(totpURI),
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

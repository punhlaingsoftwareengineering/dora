import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/auth/login');
	}

	const path = event.url.pathname;
	const isSecurityPath =
		path.startsWith('/home/security') || path.startsWith('/auth/two-factor');

	const twoFactorEnabled = Boolean(
		(event.locals.user as { twoFactorEnabled?: boolean | null }).twoFactorEnabled
	);

	if (!twoFactorEnabled && !isSecurityPath) {
		throw redirect(302, '/home/security');
	}

	return {
		user: event.locals.user,
		twoFactorEnabled
	};
};

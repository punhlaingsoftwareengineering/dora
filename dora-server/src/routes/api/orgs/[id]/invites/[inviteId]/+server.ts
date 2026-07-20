import type { RequestHandler } from './$types';
import { jsonError, jsonOk } from '$lib/shared/zod/_helpers';
import { revokeInvite } from '$lib/server/remote/main/member';

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const invite = await revokeInvite(event.locals.user, event.params.id, event.params.inviteId);
	if (!invite) return jsonError(404, 'Not found');
	return jsonOk({ ok: true });
};

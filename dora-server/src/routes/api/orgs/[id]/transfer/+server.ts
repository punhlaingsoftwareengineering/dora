import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZTransferOwnershipInput } from '$lib/shared/zod/org';
import { transferOwnership } from '$lib/server/remote/main/org';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);
	const input = parseOrThrow(ZTransferOwnershipInput, body);
	const org = await transferOwnership(event.locals.user, event.params.id, input.newOwnerUserId);
	if (!org) return jsonError(404, 'Not found');
	return jsonOk({ ok: true, org });
};

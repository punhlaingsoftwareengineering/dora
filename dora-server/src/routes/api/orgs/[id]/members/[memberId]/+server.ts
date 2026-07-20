import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZMemberRoleUpdateInput } from '$lib/shared/zod/org';
import { removeMember, updateMemberRole } from '$lib/server/remote/main/member';

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);
	try {
		const input = parseOrThrow(ZMemberRoleUpdateInput, {
			...(body ?? {}),
			memberId: event.params.memberId
		});
		const member = await updateMemberRole(event.locals.user, {
			orgId: event.params.id,
			memberId: input.memberId,
			role: input.role
		});
		if (!member) return jsonError(404, 'Not found');
		return jsonOk({ ok: true, member });
	} catch (e) {
		return jsonError(400, e instanceof Error ? e.message : 'Update failed');
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	try {
		const member = await removeMember(event.locals.user, event.params.id, event.params.memberId);
		if (!member) return jsonError(404, 'Not found');
		return jsonOk({ ok: true });
	} catch (e) {
		return jsonError(400, e instanceof Error ? e.message : 'Remove failed');
	}
};

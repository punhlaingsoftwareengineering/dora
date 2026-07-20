import type { RequestHandler } from './$types';
import { jsonError, jsonOk, parseOrThrow } from '$lib/shared/zod/_helpers';
import { ZInviteCreateInput } from '$lib/shared/zod/org';
import { createInvite, listInvites, listMembers } from '$lib/server/remote/main/member';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const members = await listMembers(event.locals.user, event.params.id);
	if (!members) return jsonError(404, 'Not found');
	const invites = await listInvites(event.locals.user, event.params.id);
	return jsonOk({ ok: true, members, invites: invites ?? [] });
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');
	const body = await event.request.json().catch(() => null);
	try {
		const input = parseOrThrow(ZInviteCreateInput, body);
		const invite = await createInvite(event.locals.user, {
			orgId: event.params.id,
			email: input.email,
			role: input.role
		});
		if (!invite) return jsonError(403, 'Forbidden');
		return jsonOk({ ok: true, invite });
	} catch (e) {
		return jsonError(400, e instanceof Error ? e.message : 'Invite failed');
	}
};

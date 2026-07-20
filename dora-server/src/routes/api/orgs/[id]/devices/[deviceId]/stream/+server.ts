import type { RequestHandler } from './$types';
import { jsonError } from '$lib/shared/zod/_helpers';
import { db } from '$lib/server/db';
import { main_device } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { hub } from '$lib/server/ws/hub';
import { requireOrgRole } from '$lib/server/org_access';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return jsonError(401, 'Unauthorized');

	const access = await requireOrgRole(event.locals.user.id, event.params.id, 'member');
	if (!access) return jsonError(404, 'Not found');

	const device = await db.query.main_device.findFirst({
		where: and(eq(main_device.id, event.params.deviceId), eq(main_device.orgId, event.params.id))
	});
	if (!device) return jsonError(404, 'Not found');

	const stream = new ReadableStream({
		start(controller) {
			const encoder = new TextEncoder();
			let closed = false;
			const send = (data: Record<string, unknown>) => {
				if (closed) return;
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
			};

			send({ type: 'connected', deviceId: device.id });

			const unsub = hub.subscribeDevice(device.id, { send });

			event.request.signal.addEventListener('abort', () => {
				if (closed) return;
				closed = true;
				try {
					unsub();
				} finally {
					try {
						controller.close();
					} catch {
						// ignore double-close / already closed
					}
				}
			});
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache',
			connection: 'keep-alive'
		}
	});
};

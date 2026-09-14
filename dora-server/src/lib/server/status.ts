import { db } from '$lib/server/db';
import { master_status } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { ZMasterStatusCode } from '$lib/shared/zod/master';

type StatusCode = z.infer<typeof ZMasterStatusCode>;

const codeToId = new Map<StatusCode, string>();
const idToCode = new Map<string, string>();
let warmed = false;

async function ensureWarm() {
	if (warmed) return;
	const rows = await db.select().from(master_status);
	for (const row of rows) {
		codeToId.set(row.code as StatusCode, row.id);
		idToCode.set(row.id, row.code);
	}
	warmed = true;
}

export async function getMasterStatusId(code: StatusCode) {
	await ensureWarm();
	const cached = codeToId.get(code);
	if (cached) return cached;

	const row = await db.query.master_status.findFirst({
		where: eq(master_status.code, code)
	});
	if (!row) throw new Error(`master_status not seeded: ${code}`);

	codeToId.set(code, row.id);
	idToCode.set(row.id, row.code);
	return row.id;
}

export async function getMasterStatusCode(id: string) {
	await ensureWarm();
	const cached = idToCode.get(id);
	if (cached) return cached;

	const row = await db.query.master_status.findFirst({
		where: eq(master_status.id, id)
	});
	if (!row) return null;

	idToCode.set(row.id, row.code);
	codeToId.set(row.code as StatusCode, row.id);
	return row.code;
}

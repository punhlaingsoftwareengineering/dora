import { db } from '$lib/server/db';
import { main_org_proxy } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import { bumpOrgConfigVersion, requireOrgRole, type AuthedUser } from '$lib/server/org_access';

export async function upsertProxy(user: AuthedUser, input: { orgId: string; host: string; port: number }) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const activeId = await getMasterStatusId('ACTIVE');

	const existing = await db.query.main_org_proxy.findFirst({
		where: eq(main_org_proxy.orgId, input.orgId)
	});

	let row;
	if (existing) {
		[row] = await db
			.update(main_org_proxy)
			.set({ host: input.host, port: input.port })
			.where(eq(main_org_proxy.id, existing.id))
			.returning();
	} else {
		[row] = await db
			.insert(main_org_proxy)
			.values({
				orgId: input.orgId,
				host: input.host,
				port: input.port,
				masterStatusId: activeId
			})
			.returning();
	}

	await bumpOrgConfigVersion(input.orgId);
	return row;
}

export async function deleteProxy(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'admin');
	if (!access) return null;

	const [row] = await db.delete(main_org_proxy).where(eq(main_org_proxy.orgId, orgId)).returning();
	await bumpOrgConfigVersion(orgId);
	return row ?? null;
}

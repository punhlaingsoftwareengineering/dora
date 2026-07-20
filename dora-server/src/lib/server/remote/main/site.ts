import { db } from '$lib/server/db';
import { main_org_site } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import { bumpOrgConfigVersion, requireOrgRole, type AuthedUser } from '$lib/server/org_access';

export function listSites(user: AuthedUser, orgId: string) {
	const run = async () => {
		const access = await requireOrgRole(user.id, orgId, 'member');
		if (!access) return null;

		return db.query.main_org_site.findMany({
			where: eq(main_org_site.orgId, orgId),
			orderBy: desc(main_org_site.createdAt)
		});
	};

	return Object.assign(run, { refresh: run });
}

export async function createSite(
	user: AuthedUser,
	input: { orgId: string; label: string; urlPattern: string }
) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const activeId = await getMasterStatusId('ACTIVE');
	const [row] = await db
		.insert(main_org_site)
		.values({
			orgId: input.orgId,
			label: input.label,
			urlPattern: input.urlPattern,
			masterStatusId: activeId
		})
		.returning();
	await bumpOrgConfigVersion(input.orgId);
	return row;
}

export async function updateSite(
	user: AuthedUser,
	input: { id: string; orgId: string; label: string; urlPattern: string }
) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const [row] = await db
		.update(main_org_site)
		.set({ label: input.label, urlPattern: input.urlPattern })
		.where(and(eq(main_org_site.id, input.id), eq(main_org_site.orgId, input.orgId)))
		.returning();
	await bumpOrgConfigVersion(input.orgId);
	return row ?? null;
}

export async function deleteSite(user: AuthedUser, input: { id: string; orgId: string }) {
	const access = await requireOrgRole(user.id, input.orgId, 'admin');
	if (!access) return null;

	const [row] = await db
		.delete(main_org_site)
		.where(and(eq(main_org_site.id, input.id), eq(main_org_site.orgId, input.orgId)))
		.returning();
	await bumpOrgConfigVersion(input.orgId);
	return row ?? null;
}

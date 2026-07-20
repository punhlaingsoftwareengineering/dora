import { db } from '$lib/server/db';
import { main_org_proxy, main_org_site, main_org_secret } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { requireOrgRole, type AuthedUser } from '$lib/server/org_access';

export async function getOrgDetail(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'member');
	if (!access) return null;

	const proxy = await db.query.main_org_proxy.findFirst({
		where: eq(main_org_proxy.orgId, orgId)
	});

	const sites = await db.query.main_org_site.findMany({
		where: eq(main_org_site.orgId, orgId),
		orderBy: desc(main_org_site.createdAt)
	});

	const activeSecret = await db.query.main_org_secret.findFirst({
		where: and(eq(main_org_secret.orgId, orgId), eq(main_org_secret.isActive, true)),
		orderBy: desc(main_org_secret.rotatedAt)
	});

	return {
		org: access.org,
		role: access.role,
		proxy: proxy ?? null,
		sites,
		activeSecret: activeSecret ?? null
	};
}

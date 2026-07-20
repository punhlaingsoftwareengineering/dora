import { db } from '$lib/server/db';
import { main_org, main_org_member } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import {
	ensureOwnerMembership,
	listOrgsForUser,
	requireOrgRole,
	type AuthedUser
} from '$lib/server/org_access';

export function listOrgs(user: AuthedUser) {
	const run = async () => listOrgsForUser(user.id);

	return Object.assign(run, {
		refresh: run
	});
}

export async function createOrg(user: AuthedUser, input: { name: string }) {
	const activeId = await getMasterStatusId('ACTIVE');
	const [row] = await db
		.insert(main_org)
		.values({
			ownerUserId: user.id,
			name: input.name,
			configVersion: 1,
			masterStatusId: activeId
		})
		.returning();

	await ensureOwnerMembership(row.id, user.id);
	return row;
}

export async function updateOrg(user: AuthedUser, input: { id: string; name: string }) {
	const access = await requireOrgRole(user.id, input.id, 'owner');
	if (!access) return null;

	const [row] = await db
		.update(main_org)
		.set({ name: input.name })
		.where(eq(main_org.id, input.id))
		.returning();

	return row ?? null;
}

export async function deleteOrg(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'owner');
	if (!access) return null;

	const [row] = await db.delete(main_org).where(eq(main_org.id, orgId)).returning();
	return row ?? null;
}

export async function transferOwnership(user: AuthedUser, orgId: string, newOwnerUserId: string) {
	const access = await requireOrgRole(user.id, orgId, 'owner');
	if (!access) return null;

	const activeId = await getMasterStatusId('ACTIVE');
	const target = await db.query.main_org_member.findFirst({
		where: and(
			eq(main_org_member.orgId, orgId),
			eq(main_org_member.userId, newOwnerUserId),
			eq(main_org_member.masterStatusId, activeId)
		)
	});
	if (!target) return null;

	await db
		.update(main_org_member)
		.set({ role: 'admin' })
		.where(and(eq(main_org_member.orgId, orgId), eq(main_org_member.userId, user.id)));

	await db
		.update(main_org_member)
		.set({ role: 'owner' })
		.where(eq(main_org_member.id, target.id));

	const [row] = await db
		.update(main_org)
		.set({ ownerUserId: newOwnerUserId })
		.where(eq(main_org.id, orgId))
		.returning();

	return row ?? null;
}

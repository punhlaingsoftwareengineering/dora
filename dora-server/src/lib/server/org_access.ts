import { db } from '$lib/server/db';
import { main_org, main_org_member, master_status, user } from '$lib/server/db/schema';
import type { OrgRole } from '$lib/server/db/main/org_member';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';

export type AuthedUser = { id: string; email?: string | null; name?: string | null };

const ROLE_RANK: Record<OrgRole, number> = {
	member: 1,
	admin: 2,
	owner: 3
};

export function roleAtLeast(role: OrgRole, min: OrgRole) {
	return ROLE_RANK[role] >= ROLE_RANK[min];
}

export async function getOrgMembership(userId: string, orgId: string) {
	const activeId = await getMasterStatusId('ACTIVE');
	const member = await db.query.main_org_member.findFirst({
		where: and(
			eq(main_org_member.orgId, orgId),
			eq(main_org_member.userId, userId),
			eq(main_org_member.masterStatusId, activeId)
		)
	});
	if (!member) return null;
	return { ...member, role: member.role as OrgRole };
}

export async function requireOrgRole(userId: string, orgId: string, minRole: OrgRole = 'member') {
	const membership = await getOrgMembership(userId, orgId);
	if (!membership || !roleAtLeast(membership.role, minRole)) return null;

	const org = await db.query.main_org.findFirst({
		where: eq(main_org.id, orgId)
	});
	if (!org) return null;

	return { org, membership, role: membership.role };
}

export async function bumpOrgConfigVersion(orgId: string) {
	const org = await db.query.main_org.findFirst({ where: eq(main_org.id, orgId) });
	if (!org) return null;
	const next = (org.configVersion ?? 1) + 1;
	const [row] = await db
		.update(main_org)
		.set({ configVersion: next })
		.where(eq(main_org.id, orgId))
		.returning();
	return row;
}

export async function ensureOwnerMembership(orgId: string, ownerUserId: string) {
	const activeId = await getMasterStatusId('ACTIVE');
	const existing = await db.query.main_org_member.findFirst({
		where: and(eq(main_org_member.orgId, orgId), eq(main_org_member.userId, ownerUserId))
	});
	if (existing) {
		if (existing.role !== 'owner' || existing.masterStatusId !== activeId) {
			await db
				.update(main_org_member)
				.set({ role: 'owner', masterStatusId: activeId })
				.where(eq(main_org_member.id, existing.id));
		}
		return;
	}
	await db.insert(main_org_member).values({
		orgId,
		userId: ownerUserId,
		role: 'owner',
		masterStatusId: activeId
	});
}

export async function backfillOwnerMemberships() {
	const orgs = await db.select().from(main_org);
	for (const org of orgs) {
		await ensureOwnerMembership(org.id, org.ownerUserId);
	}
}

export async function listOrgsForUser(userId: string) {
	const activeId = await getMasterStatusId('ACTIVE');
	const memberships = await db
		.select({
			org: main_org,
			role: main_org_member.role
		})
		.from(main_org_member)
		.innerJoin(main_org, eq(main_org.id, main_org_member.orgId))
		.where(and(eq(main_org_member.userId, userId), eq(main_org_member.masterStatusId, activeId)))
		.orderBy(desc(main_org.createdAt));

	return memberships.map((m) => ({
		...m.org,
		role: m.role as OrgRole
	}));
}

export async function listMembersWithUsers(orgId: string) {
	const activeId = await getMasterStatusId('ACTIVE');
	const rows = await db
		.select({
			id: main_org_member.id,
			orgId: main_org_member.orgId,
			userId: main_org_member.userId,
			role: main_org_member.role,
			createdAt: main_org_member.createdAt,
			email: user.email,
			name: user.name
		})
		.from(main_org_member)
		.innerJoin(user, eq(user.id, main_org_member.userId))
		.where(and(eq(main_org_member.orgId, orgId), eq(main_org_member.masterStatusId, activeId)))
		.orderBy(desc(main_org_member.createdAt));

	return rows.map((r) => ({ ...r, role: r.role as OrgRole }));
}

export function isOnline(lastSeenAt: Date | string | null | undefined, windowMs = 2 * 60 * 1000) {
	if (!lastSeenAt) return false;
	const t = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
	return Date.now() - t <= windowMs;
}

export function relativeFreshness(lastSeenAt: Date | string | null | undefined) {
	if (!lastSeenAt) return 'never';
	const t = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt.getTime();
	const diff = Math.max(0, Date.now() - t);
	const sec = Math.floor(diff / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	if (hr < 48) return `${hr}h ago`;
	const days = Math.floor(hr / 24);
	return `${days}d ago`;
}

export async function getStatusCodesByIds(ids: string[]) {
	if (ids.length === 0) return new Map<string, string>();
	const rows = await db.select().from(master_status).where(inArray(master_status.id, ids));
	return new Map(rows.map((r) => [r.id, r.code]));
}

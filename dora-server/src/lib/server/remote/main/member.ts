import { db } from '$lib/server/db';
import { main_org_invite, main_org_member, user } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import {
	listMembersWithUsers,
	requireOrgRole,
	roleAtLeast,
	type AuthedUser
} from '$lib/server/org_access';
import type { OrgRole } from '$lib/server/db/main/org_member';
import { sendMail } from '$lib/server/email';
import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function listMembers(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'member');
	if (!access) return null;
	return listMembersWithUsers(orgId);
}

/** Assumes caller already verified admin+ role. */
export async function listPendingInvitesForOrg(orgId: string) {
	const pendingId = await getMasterStatusId('PENDING');
	return db.query.main_org_invite.findMany({
		where: and(eq(main_org_invite.orgId, orgId), eq(main_org_invite.masterStatusId, pendingId)),
		orderBy: desc(main_org_invite.createdAt)
	});
}

export async function listInvites(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'admin');
	if (!access) return null;
	return listPendingInvitesForOrg(orgId);
}

export async function createInvite(
	userActor: AuthedUser,
	input: { orgId: string; email: string; role: 'admin' | 'member' }
) {
	const access = await requireOrgRole(userActor.id, input.orgId, 'admin');
	if (!access) return null;

	const email = input.email.trim().toLowerCase();
	const activeId = await getMasterStatusId('ACTIVE');
	const pendingId = await getMasterStatusId('PENDING');

	const existingUser = await db.query.user.findFirst({ where: eq(user.email, email) });
	if (existingUser) {
		const already = await db.query.main_org_member.findFirst({
			where: and(
				eq(main_org_member.orgId, input.orgId),
				eq(main_org_member.userId, existingUser.id),
				eq(main_org_member.masterStatusId, activeId)
			)
		});
		if (already) throw new Error('User is already a member');
	}

	await db
		.update(main_org_invite)
		.set({ masterStatusId: await getMasterStatusId('REJECTED') })
		.where(
			and(
				eq(main_org_invite.orgId, input.orgId),
				eq(main_org_invite.email, email),
				eq(main_org_invite.masterStatusId, pendingId)
			)
		);

	const token = crypto.randomBytes(24).toString('base64url');
	const [row] = await db
		.insert(main_org_invite)
		.values({
			orgId: input.orgId,
			email,
			role: input.role,
			token,
			invitedByUserId: userActor.id,
			expiresAt: new Date(Date.now() + INVITE_TTL_MS),
			masterStatusId: pendingId
		})
		.returning();

	const origin = env.ORIGIN ?? 'http://localhost:5173';
	const link = `${origin}/auth/invite/${token}`;
	await sendMail({
		to: email,
		subject: `You're invited to ${access.org.name} on Dora`,
		html: `<p>You've been invited to join <strong>${access.org.name}</strong> as <strong>${input.role}</strong>.</p><p><a href="${link}">Open invite &amp; set your password</a></p><p>This link expires in 7 days. No separate sign-up form is needed.</p>`,
		text: `You've been invited to join ${access.org.name} as ${input.role}. Open this link and set your password to join: ${link}`
	});

	return row;
}

export async function revokeInvite(userActor: AuthedUser, orgId: string, inviteId: string) {
	const access = await requireOrgRole(userActor.id, orgId, 'admin');
	if (!access) return null;

	const rejectedId = await getMasterStatusId('REJECTED');
	const [row] = await db
		.update(main_org_invite)
		.set({ masterStatusId: rejectedId })
		.where(and(eq(main_org_invite.id, inviteId), eq(main_org_invite.orgId, orgId)))
		.returning();
	return row ?? null;
}

export async function acceptInvite(userActor: AuthedUser & { email: string }, token: string) {
	const invite = await db.query.main_org_invite.findFirst({
		where: eq(main_org_invite.token, token)
	});
	if (!invite) throw new Error('Invite not found');

	const pendingId = await getMasterStatusId('PENDING');
	if (invite.masterStatusId !== pendingId) throw new Error('Invite is no longer valid');
	if (invite.expiresAt.getTime() < Date.now()) throw new Error('Invite has expired');

	const email = userActor.email.trim().toLowerCase();
	if (email !== invite.email.toLowerCase()) {
		throw new Error('Signed-in email does not match the invitation');
	}

	const activeId = await getMasterStatusId('ACTIVE');
	const approvedId = await getMasterStatusId('APPROVED');

	const existing = await db.query.main_org_member.findFirst({
		where: and(eq(main_org_member.orgId, invite.orgId), eq(main_org_member.userId, userActor.id))
	});

	if (existing) {
		await db
			.update(main_org_member)
			.set({ role: invite.role, masterStatusId: activeId })
			.where(eq(main_org_member.id, existing.id));
	} else {
		await db.insert(main_org_member).values({
			orgId: invite.orgId,
			userId: userActor.id,
			role: invite.role,
			masterStatusId: activeId
		});
	}

	await db
		.update(main_org_invite)
		.set({ masterStatusId: approvedId })
		.where(eq(main_org_invite.id, invite.id));

	return { orgId: invite.orgId, role: invite.role as OrgRole };
}

export async function updateMemberRole(
	userActor: AuthedUser,
	input: { orgId: string; memberId: string; role: 'admin' | 'member' }
) {
	const access = await requireOrgRole(userActor.id, input.orgId, 'admin');
	if (!access) return null;

	const member = await db.query.main_org_member.findFirst({
		where: and(eq(main_org_member.id, input.memberId), eq(main_org_member.orgId, input.orgId))
	});
	if (!member) return null;
	if (member.role === 'owner') throw new Error('Cannot change owner role this way');

	if (access.role === 'admin' && member.role === 'admin') {
		throw new Error('Admins cannot change other admins');
	}
	if (access.role === 'admin' && input.role === 'admin') {
		throw new Error('Admins cannot promote to admin');
	}

	const [row] = await db
		.update(main_org_member)
		.set({ role: input.role })
		.where(eq(main_org_member.id, member.id))
		.returning();
	return row ?? null;
}

export async function removeMember(userActor: AuthedUser, orgId: string, memberId: string) {
	const access = await requireOrgRole(userActor.id, orgId, 'admin');
	if (!access) return null;

	const member = await db.query.main_org_member.findFirst({
		where: and(eq(main_org_member.id, memberId), eq(main_org_member.orgId, orgId))
	});
	if (!member) return null;
	if (member.role === 'owner') throw new Error('Cannot remove the owner');
	if (member.userId === userActor.id) throw new Error('Cannot remove yourself');

	if (access.role === 'admin' && roleAtLeast(member.role as OrgRole, 'admin')) {
		throw new Error('Admins can only remove members');
	}

	const disabledId = await getMasterStatusId('DISABLED');
	const [row] = await db
		.update(main_org_member)
		.set({ masterStatusId: disabledId })
		.where(eq(main_org_member.id, member.id))
		.returning();
	return row ?? null;
}

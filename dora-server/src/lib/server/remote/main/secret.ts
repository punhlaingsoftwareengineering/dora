import { db } from '$lib/server/db';
import { main_org_secret } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import crypto from 'node:crypto';
import { orgCodeFromName, randomSecret, sha256Hex } from '$lib/server/crypto';
import { bumpOrgConfigVersion, requireOrgRole, type AuthedUser } from '$lib/server/org_access';

export async function rotateOrgSecret(user: AuthedUser, orgId: string) {
	const access = await requireOrgRole(user.id, orgId, 'admin');
	if (!access) return null;

	const activeId = await getMasterStatusId('ACTIVE');

	await db
		.update(main_org_secret)
		.set({ isActive: false })
		.where(and(eq(main_org_secret.orgId, orgId), eq(main_org_secret.isActive, true)));

	let orgName = orgCodeFromName(access.org.name);
	for (let i = 0; i < 5; i++) {
		const existing = await db.query.main_org_secret.findFirst({
			where: and(eq(main_org_secret.orgNameCurrent, orgName), eq(main_org_secret.isActive, true))
		});
		if (!existing) break;
		orgName = `${orgCodeFromName(access.org.name)}_${crypto.randomBytes(2).toString('hex')}`;
	}

	const secretKey = randomSecret(12);
	const secretKeyHash = sha256Hex(secretKey);

	const [row] = await db
		.insert(main_org_secret)
		.values({
			orgId,
			orgNameCurrent: orgName,
			secretKeyHash,
			isActive: true,
			masterStatusId: activeId
		})
		.returning();

	await bumpOrgConfigVersion(orgId);
	return { row, orgName, secretKey };
}

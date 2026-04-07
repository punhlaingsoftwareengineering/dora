import { db } from '$lib/server/db';
import { main_org, main_org_secret } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getMasterStatusId } from '$lib/server/status';
import { randomOrgName, randomSecret, sha256Hex } from '$lib/server/crypto';

type AuthedUser = { id: string };

export async function rotateOrgSecret(user: AuthedUser, orgId: string) {
	const org = await db.query.main_org.findFirst({
		where: and(eq(main_org.id, orgId), eq(main_org.ownerUserId, user.id))
	});
	if (!org) return null;

	const activeId = await getMasterStatusId('ACTIVE');

	// deactivate any previous active secret
	await db
		.update(main_org_secret)
		.set({ isActive: false })
		.where(and(eq(main_org_secret.orgId, orgId), eq(main_org_secret.isActive, true)));

	const orgName = randomOrgName();
	const secretKey = randomSecret(32);
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

	return { row, orgName, secretKey };
}


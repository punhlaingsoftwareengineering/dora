import { z } from 'zod';
import { createZodSchema } from './_helpers';
import { ZUuidV7 } from './master';

export const ZOrgId = ZUuidV7;

export const ZOrgCreateInput = createZodSchema(
	z.object({
		name: z.string().min(2).max(120)
	})
);

export const ZOrgUpdateInput = createZodSchema(
	z.object({
		id: ZOrgId,
		name: z.string().min(2).max(120)
	})
);

export const ZOrgRole = createZodSchema(z.enum(['owner', 'admin', 'member']));
export const ZInviteRole = createZodSchema(z.enum(['admin', 'member']));

export const ZOrgRow = createZodSchema(
	z.object({
		id: ZOrgId,
		ownerUserId: z.string().min(1),
		name: z.string(),
		configVersion: z.number().int().optional(),
		masterStatusId: ZUuidV7,
		createdAt: z.coerce.date(),
		updatedAt: z.coerce.date()
	})
);

export const ZInviteCreateInput = createZodSchema(
	z.object({
		email: z.string().email().max(255),
		role: ZInviteRole
	})
);

export const ZMemberRoleUpdateInput = createZodSchema(
	z.object({
		memberId: ZUuidV7,
		role: ZInviteRole
	})
);

export const ZTransferOwnershipInput = createZodSchema(
	z.object({
		newOwnerUserId: z.string().min(1)
	})
);

export const ZProxyUpsertInput = createZodSchema(
	z.object({
		orgId: ZOrgId,
		host: z.string().min(1).max(255),
		port: z.number().int().min(1).max(65535)
	})
);

export const ZSiteCreateInput = createZodSchema(
	z.object({
		orgId: ZOrgId,
		label: z.string().min(1).max(80),
		urlPattern: z.string().min(1).max(2048)
	})
);

export const ZSiteUpdateInput = createZodSchema(
	z.object({
		id: ZUuidV7,
		orgId: ZOrgId,
		label: z.string().min(1).max(80),
		urlPattern: z.string().min(1).max(2048)
	})
);

export const ZDeleteByIdInput = createZodSchema(z.object({ id: ZUuidV7 }));


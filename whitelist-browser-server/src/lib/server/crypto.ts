import crypto from 'node:crypto';

export function sha256Hex(input: string) {
	return crypto.createHash('sha256').update(input).digest('hex');
}

export function randomSecret(bytes = 32) {
	return crypto.randomBytes(bytes).toString('base64url');
}

export function randomOrgName() {
	// human-ish identifier; uniqueness enforced by DB index for active secrets
	return `org_${crypto.randomBytes(6).toString('hex')}`;
}


import fs from 'node:fs';
import path from 'node:path';

function loadDotEnvIfPresent() {
	const envPath = path.resolve(process.cwd(), '.env');
	if (!fs.existsSync(envPath)) return;

	const raw = fs.readFileSync(envPath, 'utf8');
	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const eqIdx = trimmed.indexOf('=');
		if (eqIdx === -1) continue;

		const key = trimmed.slice(0, eqIdx).trim();
		let value = trimmed.slice(eqIdx + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		if (process.env[key] === undefined) process.env[key] = value;
	}
}

loadDotEnvIfPresent();

const RETENTION_DAYS = Number(process.env.DEVICE_EVENT_RETENTION_DAYS ?? 30);
if (!Number.isFinite(RETENTION_DAYS) || RETENTION_DAYS < 1) {
	throw new Error('DEVICE_EVENT_RETENTION_DAYS must be a positive number');
}

const [{ db }, { main_device_event }, { lt }] = await Promise.all([
	import('$lib/server/db'),
	import('$lib/server/db/schema'),
	import('drizzle-orm')
]);

const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

const result = await db.delete(main_device_event).where(lt(main_device_event.createdAt, cutoff));

// eslint-disable-next-line no-console
console.log(
	`[prune_events] deleted device events older than ${RETENTION_DAYS}d (before ${cutoff.toISOString()})${
		typeof result.rowCount === 'number' ? `: ${result.rowCount} rows` : ''
	}`
);

process.exit(0);

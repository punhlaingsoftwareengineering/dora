import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

const privateEnv: Record<string, string | undefined> = await (async () => {
	// `$env/*` is a SvelteKit virtual module. When running scripts directly with Node/tsx,
	// it won't exist, so we fall back to `process.env`.
	try {
		const mod = await import('$env/dynamic/private');
		return mod.env as Record<string, string | undefined>;
	} catch {
		return process.env as Record<string, string | undefined>;
	}
})();

if (!privateEnv.DATABASE_URL) throw new Error('DATABASE_URL is not set');

const client = new pg.Pool({ connectionString: privateEnv.DATABASE_URL });

export const db = drizzle(client, { schema });

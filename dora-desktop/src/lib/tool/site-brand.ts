/**
 * Resolve allowlist URL patterns to Simple Icons brand marks via Wash catalog
 * (`getBrand` / `BrandCatalogEntry`). Render path + hex in Svelte SVG;
 * do not use Wash React `BrandIcon`.
 */
import { getBrand, type BrandCatalogEntry } from '@menzies-mariesta-com/menzies-design-wash-ui/icons/brands/catalog';

export type SiteBrand = Pick<BrandCatalogEntry, 'title' | 'slug' | 'hex' | 'path'>;

/** Prefer Wash-style lookup by Simple Icons slug. */
export function getSiteBrand(slug: string): SiteBrand | undefined {
	const brand = getBrand(slug);
	if (!brand) return undefined;
	return {
		title: brand.title,
		slug: brand.slug,
		hex: brand.hex,
		path: brand.path
	};
}

/**
 * Hostname / registrable-domain aliases → Simple Icons slug.
 * Only map brands that exist in the catalog (many Microsoft / LinkedIn marks were removed upstream).
 */
const HOST_ALIASES: Record<string, string> = {
	'github.com': 'github',
	'gist.github.com': 'github',
	'google.com': 'google',
	'gmail.com': 'gmail',
	'youtube.com': 'youtube',
	'youtu.be': 'youtube',
	'notion.so': 'notion',
	'slack.com': 'slack',
	'figma.com': 'figma',
	'discord.com': 'discord',
	'discord.gg': 'discord',
	'zoom.us': 'zoom',
	'dropbox.com': 'dropbox',
	'salesforce.com': 'salesforce',
	'force.com': 'salesforce',
	'okta.com': 'okta',
	'atlassian.com': 'atlassian',
	'atlassian.net': 'atlassian',
	'jira.com': 'jira',
	'gitlab.com': 'gitlab',
	'bitbucket.org': 'bitbucket',
	'stackoverflow.com': 'stackoverflow',
	'stackexchange.com': 'stackexchange',
	'reddit.com': 'reddit',
	'facebook.com': 'facebook',
	'fb.com': 'facebook',
	'meta.com': 'meta',
	'instagram.com': 'instagram',
	'whatsapp.com': 'whatsapp',
	'telegram.org': 'telegram',
	't.me': 'telegram',
	'spotify.com': 'spotify',
	'netflix.com': 'netflix',
	'apple.com': 'apple',
	'icloud.com': 'icloud',
	'cloudflare.com': 'cloudflare',
	'vercel.com': 'vercel',
	'netlify.com': 'netlify',
	'npmjs.com': 'npm',
	'docker.com': 'docker',
	'openai.com': 'openai',
	'anthropic.com': 'anthropic',
	'canva.com': 'canva',
	'trello.com': 'trello',
	'asana.com': 'asana',
	'linear.app': 'linear',
	'hubspot.com': 'hubspot',
	'zendesk.com': 'zendesk',
	'intercom.com': 'intercom',
	'stripe.com': 'stripe',
	'paypal.com': 'paypal',
	'shopify.com': 'shopify',
	'wordpress.com': 'wordpress',
	'wikipedia.org': 'wikipedia',
	'medium.com': 'medium',
	'substack.com': 'substack',
	'pinterest.com': 'pinterest',
	'tiktok.com': 'tiktok',
	'twitch.tv': 'twitch',
	'x.com': 'x',
	'twitter.com': 'x',
	'proton.me': 'proton',
	'protonmail.com': 'proton',
	'duckduckgo.com': 'duckduckgo',
	'brave.com': 'brave',
	'mozilla.org': 'mozilla',
	'firefox.com': 'firefoxbrowser',
	'confluence.com': 'confluence'
};

function aliasSlugForHost(host: string): string | undefined {
	if (HOST_ALIASES[host]) return HOST_ALIASES[host];
	const labels = host.split('.');
	for (let i = 1; i < labels.length - 1; i++) {
		const suffix = labels.slice(i).join('.');
		if (HOST_ALIASES[suffix]) return HOST_ALIASES[suffix];
	}
	return undefined;
}

/** Drop a trailing public-suffix guess (com, co.uk, com.au, …). */
function nameLabels(host: string): string[] {
	const parts = host.split('.').filter(Boolean);
	if (parts.length <= 1) return parts;

	const last = parts[parts.length - 1] ?? '';
	const secondLast = parts[parts.length - 2] ?? '';

	if (
		parts.length >= 3 &&
		last.length === 2 &&
		['co', 'com', 'net', 'org', 'gov', 'ac', 'edu'].includes(secondLast)
	) {
		return parts.slice(0, -2);
	}

	return parts.slice(0, -1);
}

/**
 * Extract hostname from a concrete URL or allowlist pattern
 * (e.g. `https://github.com/*`, `*.google.com/*`).
 */
export function hostnameFromUrlOrPattern(input: string): string | null {
	const raw = input.trim();
	if (!raw) return null;

	const hostMatch = raw.match(
		/(?:https?:\/\/)?(?:\*\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i
	);
	if (hostMatch?.[1]) {
		return hostMatch[1].toLowerCase().replace(/^www\./, '');
	}

	try {
		let s = raw.replace(/\*+$/g, '');
		if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\*+\.?/, '')}`;
		s = s.replace(/\*/g, '');
		const u = new URL(s);
		const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^\*\./, '');
		return host || null;
	} catch {
		return null;
	}
}

function slugCandidatesForHost(host: string): string[] {
	const labels = nameLabels(host);
	const out: string[] = [];
	const seen = new Set<string>();

	const push = (s: string | undefined) => {
		if (!s) return;
		const slug = s.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (!slug || seen.has(slug)) return;
		seen.add(slug);
		out.push(slug);
	};

	push(aliasSlugForHost(host));

	if (labels.length) {
		push(labels.join(''));
		for (let i = labels.length - 1; i >= 0; i--) push(labels[i]);
	}

	return out;
}

/** Resolve the best Simple Icons brand for a hostname. */
export function resolveBrandFromHostname(hostname: string): SiteBrand | null {
	const host = hostname.toLowerCase().replace(/^www\./, '');
	if (!host) return null;

	for (const slug of slugCandidatesForHost(host)) {
		const brand = getSiteBrand(slug);
		if (brand) return brand;
	}
	return null;
}

/** Resolve brand from an allowlist URL pattern or absolute URL. */
export function resolveBrandFromUrlOrPattern(urlOrPattern: string): SiteBrand | null {
	const host = hostnameFromUrlOrPattern(urlOrPattern);
	if (!host) return null;
	return resolveBrandFromHostname(host);
}

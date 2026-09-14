import { describe, expect, it } from 'vitest';
import {
	hostnameFromUrlOrPattern,
	resolveBrandFromHostname,
	resolveBrandFromUrlOrPattern
} from './site-brand';

describe('hostnameFromUrlOrPattern', () => {
	it('parses allowlist patterns', () => {
		expect(hostnameFromUrlOrPattern('https://github.com/*')).toBe('github.com');
		expect(hostnameFromUrlOrPattern('https://www.google.com/*')).toBe('google.com');
		expect(hostnameFromUrlOrPattern('https://accounts.google.com/*')).toBe('accounts.google.com');
		expect(hostnameFromUrlOrPattern('*.slack.com/*')).toBe('slack.com');
	});
});

describe('resolveBrandFromHostname / pattern', () => {
	it('resolves github and google', () => {
		expect(resolveBrandFromHostname('github.com')?.slug).toBe('github');
		expect(resolveBrandFromUrlOrPattern('https://github.com/*')?.slug).toBe('github');
		expect(resolveBrandFromHostname('www.google.com')?.slug).toBe('google');
		expect(resolveBrandFromHostname('mail.google.com')?.slug).toBe('google');
		expect(resolveBrandFromHostname('accounts.google.com')?.slug).toBe('google');
	});

	it('uses aliases for x / twitter', () => {
		expect(resolveBrandFromHostname('x.com')?.slug).toBe('x');
		expect(resolveBrandFromHostname('twitter.com')?.slug).toBe('x');
	});

	it('falls back to null for unknown hosts', () => {
		expect(resolveBrandFromHostname('unknown-corp-example.invalid')).toBeNull();
		expect(resolveBrandFromUrlOrPattern('https://not-a-real-brand-zzz.example/*')).toBeNull();
	});
});

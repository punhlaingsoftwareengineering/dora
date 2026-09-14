import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { uuidTextPk } from '../_columns';
import { main_device } from './device';

export const main_device_event = pgTable(
	'main_device_event',
	{
		id: uuidTextPk('id'),
		deviceId: text('device_id')
			.notNull()
			.references(() => main_device.id, { onDelete: 'cascade' }),
		eventType: text('event_type').notNull(),
		payload: jsonb('payload_json').notNull().default({}),
		createdAt: timestamp('created_at').defaultNow().notNull()
	},
	(table) => [
		index('main_device_event_device_created_idx').on(table.deviceId, table.createdAt),
		index('main_device_event_type_idx').on(table.eventType)
	]
);

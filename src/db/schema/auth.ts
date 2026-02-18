import { relations } from "drizzle-orm"
import { 
    pgTable, 
    text, 
    timestamp, 
    primaryKey, 
    index,
    unique
} from "drizzle-orm/pg-core"

const timeStamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export const roleEnum = pgTable('role_enum', {
    role: text('role').primaryKey().notNull()
})

export const user = pgTable('user', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: timestamp('email_verified'),
    image: text('image'),
    role: text('role', { enum: ['member', 'trainer', 'admin'] }).default('member').notNull(),
    imageCldPubId: text('image_cld_pub_id'),
    ...timeStamps
}, (table) => ({
    emailIdx: index('user_email_idx').on(table.email),
}))

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    ...timeStamps
}, (table) => ({
    userIdIdx: index('session_user_id_idx').on(table.userId),
    tokenIdx: index('session_token_idx').on(table.token),
}))

export const account = pgTable('account', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: timestamp('expires_at'),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
    ...timeStamps
}, (table) => ({
    userIdIdx: index('account_user_id_idx').on(table.userId),
    providerAccountIdx: index('account_provider_account_idx').on(table.provider, table.providerAccountId),
    uniqueProviderAccount: unique('account_provider_account_unique').on(table.provider, table.providerAccountId),
}))

export const verification = pgTable('verification', {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}, (table) => ({
    identifierIdx: index('verification_identifier_idx').on(table.identifier),
}))

export const userRelations = relations(user, ({ many }) => ({
    sessions: many(session),
    accounts: many(account),
    verifications: many(verification)
}))

export const sessionRelations = relations(session, ({ one }) => ({
    user: one(user, {
        fields: [session.userId],
        references: [user.id]
    })
}))

export const accountRelations = relations(account, ({ one }) => ({
    user: one(user, {
        fields: [account.userId],
        references: [user.id]
    })
}))

export const verificationRelations = relations(verification, ({ one }) => ({
    user: one(user, {
        fields: [verification.identifier],
        references: [user.email]
    })
}))

export type User = typeof user.$inferSelect
export type NewUser = typeof user.$inferInsert
export type Session = typeof session.$inferSelect
export type NewSession = typeof session.$inferInsert
export type Account = typeof account.$inferSelect
export type NewAccount = typeof account.$inferInsert
export type Verification = typeof verification.$inferSelect
export type NewVerification = typeof verification.$inferInsert
import { relations } from "drizzle-orm"
import { pgTable, varchar, integer, timestamp, text, index, unique, jsonb } from "drizzle-orm/pg-core"
import { user } from "./auth"

const timeStamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
}

export type Schedule = {
    day: string
    startTime: string
    endTime: string
}

export const departments = pgTable('departments', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 255 }),
    ...timeStamps
})

export const workouts = pgTable('workouts', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    departmentId: integer('department_id').notNull().references(() => departments.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    description: varchar('description', { length: 255 }),
    ...timeStamps
})

export const workoutStatus = pgTable('workout_status', {
    status: varchar('status', { length: 50 }).primaryKey().notNull()
})

export const workoutSessions = pgTable('workout_sessions', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    trainerId: text('trainer_id').notNull().references(() => user.id, { onDelete: 'restrict' }),
    inviteCode: varchar('invite_code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    bannerCldPubId: text('banner_cld_pub_id'),
    bannerUrl: text('banner_url'),
    description: text('description'),
    capacity: integer('capacity').default(30).notNull(),
    status: varchar('status', { length: 50, enum: ['active', 'inactive', 'archived'] }).default('active').notNull(),
    schedules: jsonb('schedules').$type<Schedule[]>(),
    ...timeStamps
}, (table) => ({
    workoutIdIdx: index('workout_sessions_workout_id_idx').on(table.workoutId),
    trainerIdIdx: index('workout_sessions_trainer_id_idx').on(table.trainerId),
}))

export const memberWorkouts = pgTable('member_workouts', {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    memberId: text('member_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
    workoutSessionId: integer('workout_session_id').notNull().references(() => workoutSessions.id, { onDelete: 'cascade' }),
    ...timeStamps
}, (table) => ({
    memberIdIdx: index('member_workouts_member_id_idx').on(table.memberId),
    workoutSessionIdIdx: index('member_workouts_workout_session_id_idx').on(table.workoutSessionId),
    uniqueMemberWorkout: unique('member_workouts_unique').on(table.memberId, table.workoutSessionId),
}))

export const departmentsRelations = relations(departments, ({ many }) => ({ workouts: many(workouts) }))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({ 
    department: one(departments, { 
        fields: [workouts.departmentId], 
        references: [departments.id] 
    }),
    workoutSessions: many(workoutSessions)
}))

export const workoutSessionsRelations = relations(workoutSessions, ({ one, many }) => ({
    workout: one(workouts, {
        fields: [workoutSessions.workoutId],
        references: [workouts.id]
    }),
    trainer: one(user, {
        fields: [workoutSessions.trainerId],
        references: [user.id]
    }),
    memberWorkouts: many(memberWorkouts)
}))

export const memberWorkoutsRelations = relations(memberWorkouts, ({ one }) => ({
    member: one(user, {
        fields: [memberWorkouts.memberId],
        references: [user.id]
    }),
    workoutSession: one(workoutSessions, {
        fields: [memberWorkouts.workoutSessionId],
        references: [workoutSessions.id]
    })
}))

export type Departments = typeof departments.$inferSelect
export type NewDepartments = typeof departments.$inferInsert

export type Workouts = typeof workouts.$inferSelect
export type NewWorkouts = typeof workouts.$inferInsert

export type WorkoutSession = typeof workoutSessions.$inferSelect
export type NewWorkoutSession = typeof workoutSessions.$inferInsert

export type MemberWorkout = typeof memberWorkouts.$inferSelect
export type NewMemberWorkout = typeof memberWorkouts.$inferInsert
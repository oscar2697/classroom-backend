import { relations } from "drizzle-orm"
import { pgTable, varchar, integer, timestamp } from "drizzle-orm/pg-core"

const timeStamps = {
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull()
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

export const departmentsRelations = relations(departments, ({ many }) => ({ workouts: many(workouts) }))

export const workoutsRelations = relations(workouts, ({ one, many }) => ({ 
    department: one(departments, { 
        fields: [workouts.departmentId], 
        references: [departments.id] 
    }) 
}))

export type Departments = typeof departments.$inferSelect
export type NewDepartments = typeof departments.$inferInsert

export type Workouts = typeof workouts.$inferSelect
export type NewWorkouts = typeof workouts.$inferInsert
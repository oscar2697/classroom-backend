import { and, desc, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { departments, workouts } from '../db/schema/index.js'
import { db } from '../db/index.js'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, Number(page) || 1)
        const limitPage = Math.max(1, Math.min(Number(limit) || 10, 100))
        const offset = (currentPage - 1) * limitPage
        const filterConditions = []

        if (search) {
            filterConditions.push(
                or(
                    ilike(workouts.name, `%${search}%`),
                    ilike(workouts.code, `%${search}%`),
                )
            )
        }

        if (department) {
            filterConditions.push(
                ilike(departments.name, `%${department}%`)
            )
            const deptPattern = `%${String(department).replace(/[%_]/g, '\\$&')}%`
            filterConditions.push(ilike(departments.name, deptPattern))
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(workouts)
            .leftJoin(departments, eq(workouts.departmentId, departments.id))
            .where(whereClause)

        const totalCount = result[0]?.count ?? 0

        const workoutsList = await db
            .select({
                ...getTableColumns(workouts),
                department: { ...getTableColumns(departments) }
            }).from(workouts).leftJoin(departments, eq(workouts.departmentId, departments.id))
            .where(whereClause)
            .orderBy(desc(workouts.createdAt))
            .limit(limitPage)
            .offset(offset)

        res.status(200).json({
            data: workoutsList,
            pagination: {
                page: currentPage,
                limit: limitPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPage)
            }
        })
    } catch (error) {
        console.error(`GET /workouts error: ${error}`)
        res.status(500).json({ error: 'Failed to get workouts' })
    }
})

// GET /workouts/:id - Get single workout
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const workout = await db
            .select({
                ...getTableColumns(workouts),
                department: { ...getTableColumns(departments) }
            })
            .from(workouts)
            .leftJoin(departments, eq(workouts.departmentId, departments.id))
            .where(eq(workouts.id, Number(id)))
            .limit(1)

        if (workout.length === 0) {
            return res.status(404).json({ error: 'Workout not found' })
        }

        res.status(200).json({ data: workout[0] })
    } catch (error) {
        console.error(`GET /workouts/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to get workout' })
    }
})

// POST /workouts - Create workout
router.post('/', async (req, res) => {
    try {
        const { departmentId, name, code, description } = req.body

        if (!departmentId || !name || !code) {
            return res.status(400).json({ error: 'Department ID, name, and code are required' })
        }

        // Check if department exists
        const deptExists = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, Number(departmentId)))
            .limit(1)

        if (deptExists.length === 0) {
            return res.status(400).json({ error: 'Department not found' })
        }

        // Check if code already exists
        const existingWorkout = await db
            .select({ id: workouts.id })
            .from(workouts)
            .where(eq(workouts.code, code))
            .limit(1)

        if (existingWorkout.length > 0) {
            return res.status(409).json({ error: 'Workout code already exists' })
        }

        const newWorkout = await db
            .insert(workouts)
            .values({
                departmentId: Number(departmentId),
                name,
                code,
                description: description || null,
            })
            .returning({
                ...getTableColumns(workouts),
            })

        // Fetch the complete workout with department
        if (newWorkout[0]) {
            const completeWorkout = await db
                .select({
                    ...getTableColumns(workouts),
                    department: { ...getTableColumns(departments) }
                })
                .from(workouts)
                .leftJoin(departments, eq(workouts.departmentId, departments.id))
                .where(eq(workouts.id, newWorkout[0]?.id as number))
                .limit(1)

            res.status(201).json({ data: completeWorkout[0] || null })
        } else {
            res.status(500).json({ error: 'Failed to create workout' })
        }
    } catch (error) {
        console.error(`POST /workouts error: ${error}`)
        res.status(500).json({ error: 'Failed to create workout' })
    }
})

// PUT /workouts/:id - Update workout
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { departmentId, name, code, description } = req.body

        if (!departmentId || !name || !code) {
            return res.status(400).json({ error: 'Department ID, name, and code are required' })
        }

        // Check if workout exists
        const existingWorkout = await db
            .select({ id: workouts.id })
            .from(workouts)
            .where(eq(workouts.id, Number(id)))
            .limit(1)

        if (existingWorkout.length === 0) {
            return res.status(404).json({ error: 'Workout not found' })
        }

        // Check if department exists
        const deptExists = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, Number(departmentId)))
            .limit(1)

        if (deptExists.length === 0) {
            return res.status(400).json({ error: 'Department not found' })
        }

        // Check if code conflicts with another workout
        const codeConflict = await db
            .select({ id: workouts.id })
            .from(workouts)
            .where(and(
                eq(workouts.code, code),
                sql`${workouts.id} != ${Number(id)}`
            ))
            .limit(1)

        if (codeConflict.length > 0) {
            return res.status(409).json({ error: 'Workout code already exists' })
        }

        const updatedWorkout = await db
            .update(workouts)
            .set({
                departmentId: Number(departmentId),
                name,
                code,
                description: description || null,
                updatedAt: new Date(),
            })
            .where(eq(workouts.id, Number(id)))
            .returning({
                ...getTableColumns(workouts),
            })

        // Fetch the complete workout with department
        if (updatedWorkout.length > 0) {
            const completeWorkout = await db
                .select({
                    ...getTableColumns(workouts),
                    department: { ...getTableColumns(departments) }
                })
                .from(workouts)
                .leftJoin(departments, eq(workouts.departmentId, departments.id))
                .where(eq(workouts.id, updatedWorkout[0]?.id as number))
                .limit(1)

            res.status(200).json({ data: completeWorkout[0] ?? null })
        } else {
            res.status(500).json({ error: 'Failed to update workout' })
        }
    } catch (error) {
        console.error(`PUT /workouts/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to update workout' })
    }
})

// DELETE /workouts/:id - Delete workout
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Check if workout exists
        const existingWorkout = await db
            .select({ id: workouts.id })
            .from(workouts)
            .where(eq(workouts.id, Number(id)))
            .limit(1)

        if (existingWorkout.length === 0) {
            return res.status(404).json({ error: 'Workout not found' })
        }

        // TODO: Check if workout has associated sessions
        // For now, we'll let the database constraint handle this

        await db
            .delete(workouts)
            .where(eq(workouts.id, Number(id)))

        res.status(200).json({ message: 'Workout deleted successfully' })
    } catch (error) {
        console.error(`DELETE /workouts/:id error: ${error}`)
        
        // Check for foreign key constraint violation
        if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
            return res.status(409).json({ error: 'Cannot delete workout with associated sessions' })
        }
        
        res.status(500).json({ error: 'Failed to delete workout' })
    }
})

export default router
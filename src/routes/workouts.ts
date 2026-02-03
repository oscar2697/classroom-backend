import { and, desc, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { departments, workouts } from '../db/schema'
import { db } from '../db'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const { search, department, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, +page)
        const limitPage = Math.max(1, +limit)
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

export default router
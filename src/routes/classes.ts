import { and, desc, eq, getTableColumns, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { db } from '../db/index.js'
import { user, workouts, workoutSessions } from '../db/schema/index.js'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const { search, workouts: workoutFilter, trainer, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, Number(page) || 1)
        const limitPage = Math.max(1, Math.min(Number(limit) || 10, 100))
        const offset = (currentPage - 1) * limitPage
        const filterConditions = []

        if (search) {
            filterConditions.push(
                or(
                    ilike(workoutSessions.name, `%${search}%`),
                    ilike(workoutSessions.inviteCode, `%${search}%`)
                )
            )
        }

        if (workoutFilter) {
            filterConditions.push(
                ilike(workouts.name, `%${workoutFilter}%`)
            )
        }

        if (trainer) {
            filterConditions.push(
                ilike(user.name, `%${trainer}%`)
            )
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

        const result = await db
            .select({ count: sql<number>`count(*)` })
            .from(workoutSessions)
            .leftJoin(workouts, eq(workoutSessions.workoutId, workouts.id))
            .leftJoin(user, eq(workoutSessions.trainerId, user.id))
            .where(whereClause)

        const totalCount = result[0]?.count ?? 0

        const sessionsList = await db
            .select({
                ...getTableColumns(workoutSessions),
                workout: { ...getTableColumns(workouts) },
                trainer: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            })
            .from(workoutSessions)
            .leftJoin(workouts, eq(workoutSessions.workoutId, workouts.id))
            .leftJoin(user, eq(workoutSessions.trainerId, user.id))
            .where(whereClause)
            .orderBy(desc(workoutSessions.createdAt))
            .limit(limitPage)
            .offset(offset)

        res.status(200).json({
            data: sessionsList,
            pagination: {
                page: currentPage,
                limit: limitPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPage)
            }
        })
    } catch (error) {
        console.error(`GET /sessions error: ${error}`)
        res.status(500).json({ error: 'Failed to get sessions' })
    }
})

router.post('/', async (req, res) => {
    try {
        const [createdSession] = await db
            .insert(workoutSessions)  
            .values({
                name: req.body.name,
                description: req.body.description,
                workoutId: req.body.workoutId,
                trainerId: req.body.trainerId,
                capacity: req.body.capacity,
                status: req.body.status || 'active',
                bannerUrl: req.body.bannerUrl,
                bannerCldPubId: req.body.bannerCldPubId,
                inviteCode: Math.random().toString(35).substring(2, 9),
                schedules: []
            })
            .returning({ id: workoutSessions.id })

        if (!createdSession) throw Error

        res.status(201).json({ data: createdSession })
    } catch (error) {
        console.error(`POST /sessions error ${error}`)
        res.status(500).json({ error })
    }
})

export default router
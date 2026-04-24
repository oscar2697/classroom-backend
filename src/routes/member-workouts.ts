import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { memberWorkouts, workoutSessions, user } from '../db/schema/index.js'
import { db } from '../db/index.js'

const router = express.Router()

// GET /member-workouts - List member enrollments with filters
router.get('/', async (req, res) => {
    try {
        const { workoutSessionId, memberId, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, Number(page) || 1)
        const limitPage = Math.max(1, Math.min(Number(limit) || 10, 100))
        const offset = (currentPage - 1) * limitPage
        const filterConditions = []

        if (workoutSessionId) {
            filterConditions.push(
                eq(memberWorkouts.workoutSessionId, Number(workoutSessionId))
            )
        }

        if (memberId) {
            filterConditions.push(
                eq(memberWorkouts.memberId, String(memberId))
            )
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(memberWorkouts)
            .where(whereClause)

        const totalCount = countResult[0]?.count ?? 0

        const enrollmentsList = await db
            .select({
                id: memberWorkouts.id,
                memberId: memberWorkouts.memberId,
                workoutSessionId: memberWorkouts.workoutSessionId,
                createdAt: memberWorkouts.createdAt,
                updatedAt: memberWorkouts.updatedAt,
                member: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    image: user.image,
                },
                workoutSession: {
                    id: workoutSessions.id,
                    name: workoutSessions.name,
                    inviteCode: workoutSessions.inviteCode,
                    capacity: workoutSessions.capacity,
                    status: workoutSessions.status,
                }
            })
            .from(memberWorkouts)
            .leftJoin(user, eq(memberWorkouts.memberId, user.id))
            .leftJoin(workoutSessions, eq(memberWorkouts.workoutSessionId, workoutSessions.id))
            .where(whereClause)
            .orderBy(desc(memberWorkouts.createdAt))
            .limit(limitPage)
            .offset(offset)

        res.status(200).json({
            data: enrollmentsList,
            pagination: {
                page: currentPage,
                limit: limitPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPage)
            }
        })
    } catch (error) {
        console.error(`GET /member-workouts error: ${error}`)
        res.status(500).json({ error: 'Failed to get member enrollments' })
    }
})

// GET /member-workouts/:id - Get single enrollment
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const enrollment = await db
            .select({
                id: memberWorkouts.id,
                memberId: memberWorkouts.memberId,
                workoutSessionId: memberWorkouts.workoutSessionId,
                createdAt: memberWorkouts.createdAt,
                updatedAt: memberWorkouts.updatedAt,
                member: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    image: user.image,
                },
                workoutSession: {
                    id: workoutSessions.id,
                    name: workoutSessions.name,
                    inviteCode: workoutSessions.inviteCode,
                    capacity: workoutSessions.capacity,
                    status: workoutSessions.status,
                }
            })
            .from(memberWorkouts)
            .leftJoin(user, eq(memberWorkouts.memberId, user.id))
            .leftJoin(workoutSessions, eq(memberWorkouts.workoutSessionId, workoutSessions.id))
            .where(eq(memberWorkouts.id, Number(id)))
            .limit(1)

        if (enrollment.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' })
        }

        res.status(200).json({ data: enrollment[0] })
    } catch (error) {
        console.error(`GET /member-workouts/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to get enrollment' })
    }
})

// POST /member-workouts - Enroll a member in a session
router.post('/', async (req, res) => {
    try {
        const { memberId, workoutSessionId } = req.body

        if (!memberId || !workoutSessionId) {
            return res.status(400).json({ error: 'Member ID and workout session ID are required' })
        }

        // Check if member exists
        const memberExists = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, String(memberId)))
            .limit(1)

        if (memberExists.length === 0) {
            return res.status(400).json({ error: 'Member not found' })
        }

        // Check if workout session exists
        const sessionExists = await db
            .select({ id: workoutSessions.id, capacity: workoutSessions.capacity })
            .from(workoutSessions)
            .where(eq(workoutSessions.id, Number(workoutSessionId)))
            .limit(1)

        if (sessionExists.length === 0) {
            return res.status(400).json({ error: 'Workout session not found' })
        }

        // Check if already enrolled
        const existingEnrollment = await db
            .select({ id: memberWorkouts.id })
            .from(memberWorkouts)
            .where(and(
                eq(memberWorkouts.memberId, String(memberId)),
                eq(memberWorkouts.workoutSessionId, Number(workoutSessionId))
            ))
            .limit(1)

        if (existingEnrollment.length > 0) {
            return res.status(409).json({ error: 'Member already enrolled in this session' })
        }

        // Check capacity
        const currentEnrollments = await db
            .select({ count: sql<number>`count(*)` })
            .from(memberWorkouts)
            .where(eq(memberWorkouts.workoutSessionId, Number(workoutSessionId)))

        const enrolledCount = currentEnrollments[0]?.count ?? 0
        const capacity = sessionExists[0]?.capacity

        if (capacity !== undefined && enrolledCount >= capacity) {
            return res.status(409).json({ error: 'Session is at full capacity' })
        }

        const newEnrollment = await db
            .insert(memberWorkouts)
            .values({
                memberId: String(memberId),
                workoutSessionId: Number(workoutSessionId),
            })
            .returning({
                id: memberWorkouts.id,
                memberId: memberWorkouts.memberId,
                workoutSessionId: memberWorkouts.workoutSessionId,
                createdAt: memberWorkouts.createdAt,
                updatedAt: memberWorkouts.updatedAt,
            })

        // Fetch the complete enrollment with member and session details
        if (newEnrollment[0]) {
            const completeEnrollment = await db
                .select({
                    id: memberWorkouts.id,
                    memberId: memberWorkouts.memberId,
                    workoutSessionId: memberWorkouts.workoutSessionId,
                    createdAt: memberWorkouts.createdAt,
                    updatedAt: memberWorkouts.updatedAt,
                    member: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        image: user.image,
                    },
                    workoutSession: {
                        id: workoutSessions.id,
                        name: workoutSessions.name,
                        inviteCode: workoutSessions.inviteCode,
                        capacity: workoutSessions.capacity,
                        status: workoutSessions.status,
                    }
                })
                .from(memberWorkouts)
                .leftJoin(user, eq(memberWorkouts.memberId, user.id))
                .leftJoin(workoutSessions, eq(memberWorkouts.workoutSessionId, workoutSessions.id))
                .where(eq(memberWorkouts.id, newEnrollment[0].id))
                .limit(1)

            res.status(201).json({ data: completeEnrollment[0] })
        } else {
            res.status(500).json({ error: 'Failed to create enrollment' })
        }
    } catch (error) {
        console.error(`POST /member-workouts error: ${error}`)
        res.status(500).json({ error: 'Failed to enroll member' })
    }
})

// DELETE /member-workouts/:id - Remove enrollment
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Check if enrollment exists
        const existingEnrollment = await db
            .select({ id: memberWorkouts.id })
            .from(memberWorkouts)
            .where(eq(memberWorkouts.id, Number(id)))
            .limit(1)

        if (existingEnrollment.length === 0) {
            return res.status(404).json({ error: 'Enrollment not found' })
        }

        await db
            .delete(memberWorkouts)
            .where(eq(memberWorkouts.id, Number(id)))

        res.status(200).json({ message: 'Member enrollment removed successfully' })
    } catch (error) {
        console.error(`DELETE /member-workouts/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to remove enrollment' })
    }
})

// POST /member-workouts/enroll-by-code - Enroll member using invite code
router.post('/enroll-by-code', async (req, res) => {
    try {
        const { inviteCode, memberId } = req.body

        if (!inviteCode || !memberId) {
            return res.status(400).json({ error: 'Invite code and member ID are required' })
        }

        // Find session by invite code
        const session = await db
            .select({ 
                id: workoutSessions.id, 
                name: workoutSessions.name,
                capacity: workoutSessions.capacity,
                status: workoutSessions.status
            })
            .from(workoutSessions)
            .where(eq(workoutSessions.inviteCode, String(inviteCode)))
            .limit(1)

        if (session.length === 0) {
            return res.status(404).json({ error: 'Invalid invite code' })
        }

        const sessionData = session[0]

        if (!sessionData) {
            return res.status(404).json({ error: 'Session not found' })
        }

        if (sessionData.status !== 'active') {
            return res.status(400).json({ error: 'Session is not active for enrollment' })
        }

        // Check if member exists
        const memberExists = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, String(memberId)))
            .limit(1)

        if (memberExists.length === 0) {
            return res.status(400).json({ error: 'Member not found' })
        }

        // Check if already enrolled
        const existingEnrollment = await db
            .select({ id: memberWorkouts.id })
            .from(memberWorkouts)
            .where(and(
                eq(memberWorkouts.memberId, String(memberId)),
                eq(memberWorkouts.workoutSessionId, sessionData.id)
            ))
            .limit(1)

        if (existingEnrollment.length > 0) {
            return res.status(409).json({ error: 'Member already enrolled in this session' })
        }

        // Check capacity
        const currentEnrollments = await db
            .select({ count: sql<number>`count(*)` })
            .from(memberWorkouts)
            .where(eq(memberWorkouts.workoutSessionId, sessionData.id))

        const enrolledCount = currentEnrollments[0]?.count ?? 0

        if (enrolledCount >= sessionData.capacity) {
            return res.status(409).json({ error: 'Session is at full capacity' })
        }

        // Create enrollment
        const newEnrollment = await db
            .insert(memberWorkouts)
            .values({
                memberId: String(memberId),
                workoutSessionId: sessionData.id,
            })
            .returning({
                id: memberWorkouts.id,
                memberId: memberWorkouts.memberId,
                workoutSessionId: memberWorkouts.workoutSessionId,
                createdAt: memberWorkouts.createdAt,
                updatedAt: memberWorkouts.updatedAt,
            })

        // Fetch complete enrollment details
        if (newEnrollment[0]) {
            const completeEnrollment = await db
                .select({
                    id: memberWorkouts.id,
                    memberId: memberWorkouts.memberId,
                    workoutSessionId: memberWorkouts.workoutSessionId,
                    createdAt: memberWorkouts.createdAt,
                    updatedAt: memberWorkouts.updatedAt,
                    member: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        image: user.image,
                    },
                    workoutSession: {
                        id: workoutSessions.id,
                        name: workoutSessions.name,
                        inviteCode: workoutSessions.inviteCode,
                        capacity: workoutSessions.capacity,
                        status: workoutSessions.status,
                    }
                })
                .from(memberWorkouts)
                .leftJoin(user, eq(memberWorkouts.memberId, user.id))
                .leftJoin(workoutSessions, eq(memberWorkouts.workoutSessionId, workoutSessions.id))
                .where(eq(memberWorkouts.id, newEnrollment[0].id))
                .limit(1)

            res.status(201).json({ 
                message: 'Successfully enrolled in session',
                data: completeEnrollment[0]
            })
        } else {
            res.status(500).json({ error: 'Failed to create enrollment' })
        }
    } catch (error) {
        console.error(`POST /member-workouts/enroll-by-code error: ${error}`)
        res.status(500).json({ error: 'Failed to enroll member with invite code' })
    }
})

export default router

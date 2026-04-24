import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { user } from '../db/schema/index.js'
import { db } from '../db/index.js'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const { search, role, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, Number(page) || 1)
        const limitPage = Math.max(1, Math.min(Number(limit) || 10, 100))
        const offset = (currentPage - 1) * limitPage
        const filterConditions = []

        if (search) {
            const searchPattern = `%${String(search).replace(/[%_]/g, '\\$&')}%`
            
            filterConditions.push(
                or(
                    ilike(user.name, searchPattern),
                    ilike(user.email, searchPattern),
                )
            )
        }

        if (role) {
            filterConditions.push(
                eq(user.role, String(role) as 'member' | 'trainer' | 'admin')
            )
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(user)
            .where(whereClause)

        const totalCount = countResult[0]?.count ?? 0

        const usersList = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                role: user.role,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })
            .from(user)
            .where(whereClause)
            .orderBy(desc(user.createdAt))
            .limit(limitPage)
            .offset(offset)

        res.status(200).json({
            data: usersList,
            pagination: {
                page: currentPage,
                limit: limitPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPage)
            }
        })
    } catch (error) {
        console.error(`GET /users error: ${error}`)
        res.status(500).json({ error: 'Failed to get users' })
    }
})

// GET /users/:id - Get single user
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const userRecord = await db
            .select({
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                role: user.role,
                imageCldPubId: user.imageCldPubId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })
            .from(user)
            .where(eq(user.id, id))
            .limit(1)

        if (userRecord.length === 0) {
            return res.status(404).json({ error: 'User not found' })
        }

        res.status(200).json({ data: userRecord[0] })
    } catch (error) {
        console.error(`GET /users/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to get user' })
    }
})

// POST /users - Create user
router.post('/', async (req, res) => {
    try {
        const { name, email, role = 'member', image, imageCldPubId } = req.body

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' })
        }

        if (!['member', 'trainer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be member, trainer, or admin' })
        }

        // Check if email already exists
        const existingUser = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.email, email))
            .limit(1)

        if (existingUser.length > 0) {
            return res.status(409).json({ error: 'Email already exists' })
        }

        // Generate a simple ID (in production, you'd use a proper UUID generator)
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const newUser = await db
            .insert(user)
            .values({
                id: userId,
                name,
                email,
                role,
                image: image || null,
                imageCldPubId: imageCldPubId || null,
                emailVerified: false,
            })
            .returning({
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                role: user.role,
                imageCldPubId: user.imageCldPubId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })

        res.status(201).json({ data: newUser[0] })
    } catch (error) {
        console.error(`POST /users error: ${error}`)
        res.status(500).json({ error: 'Failed to create user' })
    }
})

// PUT /users/:id - Update user
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { name, email, role, image, imageCldPubId, emailVerified } = req.body

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' })
        }

        if (role && !['member', 'trainer', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role. Must be member, trainer, or admin' })
        }

        // Check if user exists
        const existingUser = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, id))
            .limit(1)

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'User not found' })
        }

        // Check if email conflicts with another user
        const emailConflict = await db
            .select({ id: user.id })
            .from(user)
            .where(and(
                eq(user.email, email),
                sql`${user.id} != ${id}`
            ))
            .limit(1)

        if (emailConflict.length > 0) {
            return res.status(409).json({ error: 'Email already exists' })
        }

        const updatedUser = await db
            .update(user)
            .set({
                name,
                email,
                role: role || undefined,
                image: image !== undefined ? image : undefined,
                imageCldPubId: imageCldPubId !== undefined ? imageCldPubId : undefined,
                emailVerified: emailVerified !== undefined ? emailVerified : undefined,
                updatedAt: new Date(),
            })
            .where(eq(user.id, id))
            .returning({
                id: user.id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image,
                role: user.role,
                imageCldPubId: user.imageCldPubId,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            })

        res.status(200).json({ data: updatedUser[0] })
    } catch (error) {
        console.error(`PUT /users/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to update user' })
    }
})

// DELETE /users/:id - Delete user
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Check if user exists
        const existingUser = await db
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, id))
            .limit(1)

        if (existingUser.length === 0) {
            return res.status(404).json({ error: 'User not found' })
        }

        // TODO: Check if user has associated data (sessions, enrollments, etc.)
        // For now, we'll let the database constraints handle this

        await db
            .delete(user)
            .where(eq(user.id, id))

        res.status(200).json({ message: 'User deleted successfully' })
    } catch (error) {
        console.error(`DELETE /users/:id error: ${error}`)
        
        // Check for foreign key constraint violation
        if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
            return res.status(409).json({ error: 'Cannot delete user with associated data' })
        }
        
        res.status(500).json({ error: 'Failed to delete user' })
    }
})

export default router

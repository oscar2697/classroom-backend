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

export default router

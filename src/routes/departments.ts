import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import express from 'express'
import { departments } from '../db/schema/index.js'
import { db } from '../db/index.js'

const router = express.Router()

// GET /departments - List departments with search, pagination
router.get('/', async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query
        const currentPage = Math.max(1, Number(page) || 1)
        const limitPage = Math.max(1, Math.min(Number(limit) || 10, 100))
        const offset = (currentPage - 1) * limitPage
        const filterConditions = []

        if (search) {
            const searchPattern = `%${String(search).replace(/[%_]/g, '\\$&')}%`
            
            filterConditions.push(
                or(
                    ilike(departments.name, searchPattern),
                    ilike(departments.code, searchPattern),
                    ilike(departments.description, searchPattern),
                )
            )
        }

        const whereClause = filterConditions.length > 0 ? and(...filterConditions) : undefined

        const countResult = await db
            .select({ count: sql<number>`count(*)` })
            .from(departments)
            .where(whereClause)

        const totalCount = countResult[0]?.count ?? 0

        const departmentsList = await db
            .select({
                id: departments.id,
                code: departments.code,
                name: departments.name,
                description: departments.description,
                createdAt: departments.createdAt,
                updatedAt: departments.updatedAt,
            })
            .from(departments)
            .where(whereClause)
            .orderBy(desc(departments.createdAt))
            .limit(limitPage)
            .offset(offset)

        res.status(200).json({
            data: departmentsList,
            pagination: {
                page: currentPage,
                limit: limitPage,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limitPage)
            }
        })
    } catch (error) {
        console.error(`GET /departments error: ${error}`)
        res.status(500).json({ error: 'Failed to get departments' })
    }
})

// GET /departments/:id - Get single department
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params
        
        const department = await db
            .select({
                id: departments.id,
                code: departments.code,
                name: departments.name,
                description: departments.description,
                createdAt: departments.createdAt,
                updatedAt: departments.updatedAt,
            })
            .from(departments)
            .where(eq(departments.id, Number(id)))
            .limit(1)

        if (department.length === 0) {
            return res.status(404).json({ error: 'Department not found' })
        }

        res.status(200).json({ data: department[0] })
    } catch (error) {
        console.error(`GET /departments/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to get department' })
    }
})

// POST /departments - Create department
router.post('/', async (req, res) => {
    try {
        const { code, name, description } = req.body

        if (!code || !name) {
            return res.status(400).json({ error: 'Code and name are required' })
        }

        // Check if code already exists
        const existingDept = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.code, code))
            .limit(1)

        if (existingDept.length > 0) {
            return res.status(409).json({ error: 'Department code already exists' })
        }

        const newDepartment = await db
            .insert(departments)
            .values({
                code,
                name,
                description: description || null,
            })
            .returning({
                id: departments.id,
                code: departments.code,
                name: departments.name,
                description: departments.description,
                createdAt: departments.createdAt,
                updatedAt: departments.updatedAt,
            })

        res.status(201).json({ data: newDepartment[0] })
    } catch (error) {
        console.error(`POST /departments error: ${error}`)
        res.status(500).json({ error: 'Failed to create department' })
    }
})

// PUT /departments/:id - Update department
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { code, name, description } = req.body

        if (!code || !name) {
            return res.status(400).json({ error: 'Code and name are required' })
        }

        // Check if department exists
        const existingDept = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, Number(id)))
            .limit(1)

        if (existingDept.length === 0) {
            return res.status(404).json({ error: 'Department not found' })
        }

        // Check if code conflicts with another department
        const codeConflict = await db
            .select({ id: departments.id })
            .from(departments)
            .where(and(
                eq(departments.code, code),
                sql`${departments.id} != ${Number(id)}`
            ))
            .limit(1)

        if (codeConflict.length > 0) {
            return res.status(409).json({ error: 'Department code already exists' })
        }

        const updatedDepartment = await db
            .update(departments)
            .set({
                code,
                name,
                description: description || null,
                updatedAt: new Date(),
            })
            .where(eq(departments.id, Number(id)))
            .returning({
                id: departments.id,
                code: departments.code,
                name: departments.name,
                description: departments.description,
                createdAt: departments.createdAt,
                updatedAt: departments.updatedAt,
            })

        res.status(200).json({ data: updatedDepartment[0] })
    } catch (error) {
        console.error(`PUT /departments/:id error: ${error}`)
        res.status(500).json({ error: 'Failed to update department' })
    }
})

// DELETE /departments/:id - Delete department
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Check if department exists
        const existingDept = await db
            .select({ id: departments.id })
            .from(departments)
            .where(eq(departments.id, Number(id)))
            .limit(1)

        if (existingDept.length === 0) {
            return res.status(404).json({ error: 'Department not found' })
        }

        // TODO: Check if department has associated workouts
        // For now, we'll let the database constraint handle this

        await db
            .delete(departments)
            .where(eq(departments.id, Number(id)))

        res.status(200).json({ message: 'Department deleted successfully' })
    } catch (error) {
        console.error(`DELETE /departments/:id error: ${error}`)
        
        // Check for foreign key constraint violation
        if (error instanceof Error && error.message.includes('violates foreign key constraint')) {
            return res.status(409).json({ error: 'Cannot delete department with associated workouts' })
        }
        
        res.status(500).json({ error: 'Failed to delete department' })
    }
})

export default router

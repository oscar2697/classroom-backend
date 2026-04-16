import express from 'express'
import { db } from '../db/index.js'
import { workouts } from '../db/schema/index.js'
import { error } from 'node:console'

const router = express.Router()

router.post('/', async (req, res) => {
    try {
        const [createdWorkouts] = await db.
            insert(workouts)
            .values({
                ...req.body,
                inviteCode: Math.random().toString(35).substring(2, 9),
                schedules: []
            })
            .returning({ id: workouts.id })

        if (!createdWorkouts) throw error

        res.status(201).json({ data: createdWorkouts })
    } catch (error) {
        console.error(`POST /classes error ${error}`)
        res.status(500).json({ error })
    }
})

export default router
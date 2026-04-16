import AgentAPI from 'apminsight'
AgentAPI.config()

import 'dotenv/config'
import express from 'express'
import workoutsRouter from './routes/workouts.js'
import usersRouter from './routes/users.js'
import cors from 'cors'
import securityMiddleware from './middleware/security.js'
import { auth } from './lib/auth.js'
import { toNodeHandler } from "better-auth/node"

const app = express()
const PORT = 8000

if (!process.env.FRONTEND_URL) {
    console.warn('FRONTEND_URL not set, CORS may block requests')
}

app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}))

app.all("/api/auth/*splat", toNodeHandler(auth))

app.use(express.json())

app.use(securityMiddleware)

app.use('/api/workouts', workoutsRouter)
app.use('/api/users', usersRouter)
app.use('/api/workouts', workoutsRouter)

app.get('/', (req, res) => {
    res.json({ message: 'Classroom Backend API is running!' })
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
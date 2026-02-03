import express from 'express'
import workoutsRouter from './routes/workouts'
import cors from 'cors'

const app = express()
const PORT = 8000

app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}))

app.use(express.json())

app.use('/api/workouts', workoutsRouter)

app.get('/', (req, res) => {
    res.json({ message: 'Classroom Backend API is running!' })
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
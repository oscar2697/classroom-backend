import express from 'express'

const app = express()
const PORT = 8000

app.use(express.json())

app.get('/', (req, res) => {
    res.json({ message: 'Classroom Backend API is running!' })
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})
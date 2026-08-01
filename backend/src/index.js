import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { startReminderScheduler } from './jobs/reminderScheduler.js'
import { notifyRouter } from './routes/notify.js'
import { attendanceRouter } from './routes/attendance.js'
import { authRouter } from './routes/auth.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))
app.use('/notify', notifyRouter)
app.use('/attendance', attendanceRouter)
app.use('/auth', authRouter)

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`[server] listening on port ${PORT}`)
  startReminderScheduler()
})

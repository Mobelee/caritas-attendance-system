import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function TimetableSetup({ profile }) {
  const [courses, setCourses] = useState([])
  const [slots, setSlots] = useState([])
  const [form, setForm] = useState({ course_id: '', day_of_week: 1, start_time: '09:00', end_time: '10:00', venue: '' })

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: courseData } = await supabase.from('courses').select('id, code').eq('lecturer_id', profile.id)
    setCourses(courseData ?? [])

    const { data: slotData } = await supabase
      .from('timetable')
      .select('id, day_of_week, start_time, end_time, venue, course:courses(code)')
      .in('course_id', (courseData ?? []).map((c) => c.id))
      .order('day_of_week')
    setSlots(slotData ?? [])
  }

  async function addSlot(e) {
    e.preventDefault()
    if (!form.course_id) return
    await supabase.from('timetable').insert(form)
    setForm({ ...form, venue: '' })
    load()
  }

  async function removeSlot(id) {
    await supabase.from('timetable').delete().eq('id', id)
    load()
  }

  return (
    <Shell title="Timetable" subtitle="Sets the automatic schedule students see">
      <form onSubmit={addSlot} className="card mb-6 space-y-3 p-4">
        <div>
          <label className="label">Course</label>
          <select
            className="input"
            value={form.course_id}
            onChange={(e) => setForm({ ...form, course_id: e.target.value })}
          >
            <option value="">Select course</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.code}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Day</label>
            <select
              className="input"
              value={form.day_of_week}
              onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Venue</label>
            <input
              className="input"
              value={form.venue}
              onChange={(e) => setForm({ ...form, venue: e.target.value })}
              placeholder="e.g. LT 2"
            />
          </div>
          <div>
            <label className="label">Start time</label>
            <input
              type="time"
              className="input"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            />
          </div>
          <div>
            <label className="label">End time</label>
            <input
              type="time"
              className="input"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            />
          </div>
        </div>
        <button type="submit" className="btn-primary w-full">
          <Plus className="h-4 w-4" /> Add to timetable
        </button>
      </form>

      <ul className="space-y-2">
        {slots.map((slot) => (
          <li key={slot.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{slot.course.code} · {DAYS[slot.day_of_week]}</p>
              <p className="text-xs text-ink-soft">
                {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.venue || 'Venue TBA'}
              </p>
            </div>
            <button
              onClick={() => removeSlot(slot.id)}
              className="flex h-8 w-8 items-center justify-center rounded text-ink-faint hover:bg-red-light hover:text-red"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </Shell>
  )
}

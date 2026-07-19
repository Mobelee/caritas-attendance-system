// Run with: node src/seed.js
// Creates a small, realistic dataset so you can demo the full flow
// (login → course reg → timetable → start class → scan) without
// manually clicking through Supabase's dashboard.
import 'dotenv/config'
import { supabaseAdmin } from './lib/supabase.js'

const DEMO_PASSWORD = 'CaritasDemo123!'

async function createUser(email, fullName) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true
  })
  if (error) throw new Error(`createUser(${email}): ${error.message}`)
  return data.user.id
}

async function main() {
  console.log('Seeding demo data…')

  // 1. Department
  const { data: dept } = await supabaseAdmin
    .from('departments')
    .insert({ name: 'Computer Engineering', code: 'CPE' })
    .select()
    .single()
  console.log('✓ department:', dept.name)

  // 2. Lecturer
  const lecturerId = await createUser('lecturer.demo@caritasuni.edu.ng', 'Dr. Ada Nwosu')
  await supabaseAdmin.from('profiles').insert({
    id: lecturerId, role: 'lecturer', full_name: 'Dr. Ada Nwosu', email: 'lecturer.demo@caritasuni.edu.ng'
  })
  await supabaseAdmin.from('lecturers').insert({ id: lecturerId, staff_id: 'CPE-STAFF-01', department_id: dept.id })
  console.log('✓ lecturer:', 'lecturer.demo@caritasuni.edu.ng', '/', DEMO_PASSWORD)

  // 3. Admin
  const adminId = await createUser('admin.demo@caritasuni.edu.ng', 'Portal Admin')
  await supabaseAdmin.from('profiles').insert({
    id: adminId, role: 'admin', full_name: 'Portal Admin', email: 'admin.demo@caritasuni.edu.ng'
  })
  console.log('✓ admin:', 'admin.demo@caritasuni.edu.ng', '/', DEMO_PASSWORD)

  // 4. Course
  const { data: course } = await supabaseAdmin
    .from('courses')
    .insert({ code: 'CPE 415', title: 'Embedded Systems Design', department_id: dept.id, level: 400, lecturer_id: lecturerId })
    .select()
    .single()
  console.log('✓ course:', course.code)

  // 5. Timetable slot — today, 5 minutes from now, so it's easy to demo reminders
  const now = new Date()
  const start = new Date(now.getTime() + 5 * 60000)
  await supabaseAdmin.from('timetable').insert({
    course_id: course.id,
    day_of_week: now.getDay(),
    start_time: start.toTimeString().slice(0, 5),
    end_time: new Date(start.getTime() + 60 * 60000).toTimeString().slice(0, 5),
    venue: 'LT 2'
  })
  console.log('✓ timetable slot added for today')

  // 6. Students
  const students = [
    { email: 'student1.demo@caritasuni.edu.ng', name: 'Chinedu Okafor', reg: '2021/CPE/001' },
    { email: 'student2.demo@caritasuni.edu.ng', name: 'Amaka Eze', reg: '2021/CPE/002' },
    { email: 'student3.demo@caritasuni.edu.ng', name: 'Tunde Bello', reg: '2021/CPE/003' }
  ]

  for (const s of students) {
    const id = await createUser(s.email, s.name)
    await supabaseAdmin.from('profiles').insert({ id, role: 'student', full_name: s.name, email: s.email })
    await supabaseAdmin.from('students').insert({ id, reg_no: s.reg, department_id: dept.id, level: 400 })
    await supabaseAdmin.from('enrollments').insert({ student_id: id, course_id: course.id })
    console.log(`✓ student: ${s.email} / ${DEMO_PASSWORD} (reg ${s.reg}) — remember to run face enrolment for this one on first login`)
  }

  console.log('\nDone. All demo accounts use the password:', DEMO_PASSWORD)
}

main().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})

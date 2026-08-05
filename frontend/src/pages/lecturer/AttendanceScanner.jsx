import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import * as XLSX from 'xlsx'
import { CheckCircle2, Download, ScanFace, Square, UserCheck, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'
import { useToast } from '../../hooks/useToast'

const MATCH_THRESHOLD = 0.6 // 0.6 is standard face-api.js euclidean distance threshold
const MODEL_URL = '/models/weights' // see /public/models/weights — face-api.js weight files

export default function AttendanceScanner({ profile }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const intervalRef = useRef(null)
  const { push } = useToast()

  const [session, setSession] = useState(null)
  const [roster, setRoster] = useState([]) // { id, full_name, reg_no, descriptor }
  const [marked, setMarked] = useState(new Map()) // student_id -> { time: Date, method: string }
  const [modelsReady, setModelsReady] = useState(false)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    init()

    const channel = supabase
      .channel(`scanner-attendance-${sessionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `session_id=eq.${sessionId}` },
        () => {
          loadExistingAttendance()
        }
      )
      .subscribe()

    return () => {
      clearInterval(intervalRef.current)
      supabase.removeChannel(channel)
      const stream = videoRef.current?.srcObject
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  async function init() {
    try {
      if (faceapi.tf) {
        await faceapi.tf.setBackend('webgl').catch(async () => {
          console.warn('WebGL unavailable, switching to CPU backend')
          await faceapi.tf.setBackend('cpu')
        })
        await faceapi.tf.ready()
      }
    } catch (e) {
      console.warn('Backend init error:', e)
    }

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ])
    setModelsReady(true)

    const { data: sessionRow } = await supabase
      .from('class_sessions')
      .select('*, course:courses(code, title, department:departments(name, code))')
      .eq('id', sessionId)
      .single()
    setSession(sessionRow)

    const freshRoster = await fetchRosterForCourse(sessionRow.course_id)
    setRoster(freshRoster)

    await loadExistingAttendance()

    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (videoRef.current) videoRef.current.srcObject = stream

    intervalRef.current = setInterval(scanFrame, 1200)
  }

  async function loadExistingAttendance() {
    const { data: existingAtt } = await supabase
      .from('attendance')
      .select('student_id, marked_at, method')
      .eq('session_id', sessionId)

    if (existingAtt && existingAtt.length > 0) {
      const attMap = new Map()
      existingAtt.forEach((rec) => {
        attMap.set(rec.student_id, { time: new Date(rec.marked_at), method: rec.method || 'face_recognition' })
      })
      setMarked(attMap)
    }
  }

  async function fetchRosterForCourse(courseId) {
    const { data: enrolled } = await supabase
      .from('enrollments')
      .select('student:students(id, reg_no, face_descriptor, profile:profiles(full_name))')
      .eq('course_id', courseId)

    const rawStudents = (enrolled ?? []).map((e) => e.student).filter(Boolean)
    const studentIds = rawStudents.map((s) => s.id)

    const profileMap = new Map()
    if (studentIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', studentIds)
      ;(profs ?? []).forEach((p) => {
        if (p.full_name) profileMap.set(p.id, p.full_name)
      })

      const missingIds = studentIds.filter((id) => !profileMap.has(id))
      if (missingIds.length > 0) {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/auth/profiles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: missingIds })
          })
          if (res.ok) {
            const { profiles: backendProfs } = await res.json()
            ;(backendProfs ?? []).forEach((p) => {
              if (p.full_name) profileMap.set(p.id, p.full_name)
            })
          }
        } catch (e) {
          console.warn('Backend profile fetch warning:', e)
        }
      }
    }

    return rawStudents.map((s) => {
      const profName = Array.isArray(s.profile) ? s.profile[0]?.full_name : s.profile?.full_name
      return {
        id: s.id,
        reg_no: s.reg_no || 'N/A',
        full_name: profName || profileMap.get(s.id) || 'Student',
        descriptor: s.face_descriptor ? new Float32Array(s.face_descriptor) : null
      }
    })
  }

  async function scanFrame() {
    if (!videoRef.current || roster.length === 0) return
    const detections = await faceapi
      .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptors()

    for (const detection of detections) {
      let best = { student: null, distance: Infinity }
      for (const student of roster) {
        if (!student.descriptor) continue
        const distance = faceapi.euclideanDistance(detection.descriptor, student.descriptor)
        if (distance < best.distance) best = { student, distance }
      }
      if (best.student && best.distance < MATCH_THRESHOLD) {
        markAttendance(best.student, 1 - best.distance, 'face_recognition')
      }
    }
  }

  async function markAttendance(student, confidence, method = 'face_recognition') {
    const markTime = new Date()
    setMarked((prev) => {
      if (prev.has(student.id)) return prev
      const next = new Map(prev)
      next.set(student.id, { time: markTime, method })
      return next
    })

    await supabase
      .from('attendance')
      .upsert(
        {
          session_id: sessionId,
          student_id: student.id,
          confidence: confidence != null ? Number(confidence.toFixed(4)) : null,
          method,
          marked_at: markTime.toISOString()
        },
        { onConflict: 'session_id,student_id', ignoreDuplicates: true }
      )
  }

  async function endClass() {
    setEnding(true)
    await supabase
      .from('class_sessions')
      .update({ status: 'ended', actual_end: new Date().toISOString() })
      .eq('id', sessionId)

    await exportExcel()
    setEnding(false)
    push('Class session ended. Attendance Excel report downloaded!')
    navigate('/')
  }

  async function exportExcel() {
    const deptName = session?.course?.department?.name || 'Computer & Electronic Engineering'
    const courseCode = session?.course?.code || 'CEE 415'
    const courseTitle = session?.course?.title || 'Embedded Systems Design'
    const sessionDate = session?.session_date || new Date().toISOString().slice(0, 10)
    const startTime = session?.actual_start ? new Date(session.actual_start).toLocaleTimeString() : 'N/A'
    const endTime = session?.actual_end ? new Date(session.actual_end).toLocaleTimeString() : new Date().toLocaleTimeString()

    const freshRoster = await fetchRosterForCourse(session.course_id)

    // ── Step 2: fetch attendance records ─────────────────────────────
    const { data: attRecords } = await supabase
      .from('attendance')
      .select('student_id, marked_at, method')
      .eq('session_id', sessionId)

    const attMap = new Map()
    ;(attRecords ?? []).forEach((r) => {
      attMap.set(r.student_id, {
        time: r.marked_at ? new Date(r.marked_at) : null,
        method: r.method || 'face_recognition'
      })
    })

    const totalPresent = attMap.size
    const totalAbsent = Math.max(0, freshRoster.length - totalPresent)

    const reportRows = [
      ['CARITAS UNIVERSITY AMORJI-NIKE'],
      ['FACULTY OF ENGINEERING — CLASS ATTENDANCE REGISTER'],
      [''],
      ['Institution:', 'Caritas University Amorji-Nike, Enugu State'],
      ['Department:', deptName],
      ['Course Code & Title:', `${courseCode} — ${courseTitle}`],
      ['Lecturer Name:', profile?.full_name || 'Lecturer'],
      ['Session Date:', sessionDate],
      ['Class Duration:', `${startTime} to ${endTime}`],
      ['Academic Session:', '2025/2026 Session'],
      ['Summary:', `Total Enrolled: ${freshRoster.length} | Total Present: ${totalPresent} | Total Absent: ${totalAbsent}`],
      [''],
      ['S/N', 'Student Full Name', 'Registration Number', 'Time Marked', 'Verification Method', 'Attendance Status']
    ]

    freshRoster.forEach((student, index) => {
      const record = attMap.get(student.id)
      const isPresent = Boolean(record)
      const timeStr = isPresent && record.time
        ? record.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'N/A'
      const methodStr = isPresent
        ? (record.method === 'manual' ? 'Manual Check-In' : 'Facial Recognition')
        : 'N/A'

      reportRows.push([
        index + 1,
        student.full_name,
        student.reg_no,
        timeStr,
        methodStr,
        isPresent ? 'PRESENT' : 'ABSENT'
      ])
    })

    const sheet = XLSX.utils.aoa_to_sheet(reportRows)

    // Auto-fit column widths
    sheet['!cols'] = [
      { wch: 6 },  // S/N
      { wch: 34 }, // Student Name
      { wch: 22 }, // Registration Number
      { wch: 16 }, // Time Marked
      { wch: 24 }, // Verification Method
      { wch: 18 }  // Attendance Status
    ]

    // Protect sheet — password locks it in Excel/LibreOffice (read-only)
    sheet['!protect'] = {
      sheet: true,
      password: 'CARITAS2026',
      selectLockedCells: true,
      selectUnlockedCells: true,
      formatCells: false,
      formatColumns: false,
      formatRows: false,
      insertColumns: false,
      insertRows: false,
      insertHyperlinks: false,
      deleteColumns: false,
      deleteRows: false,
      sort: false,
      autoFilter: false,
      pivotTables: false,
      objects: false,
      scenarios: false
    }

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Attendance Report')
    const cleanCode = courseCode.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `CARITAS_${cleanCode}_Attendance_${sessionDate}.xlsx`
    XLSX.writeFile(workbook, filename)
  }

  return (
    <Shell
      title={session?.course?.code ?? 'Live session'}
      subtitle={`${marked.size} of ${roster.length} marked present`}
      actions={
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} type="button" className="btn-secondary">
            <Download className="h-4 w-4" /> Download Excel
          </button>
          <button onClick={endClass} disabled={ending} className="btn-primary">
            <Square className="h-4 w-4" /> End class
          </button>
        </div>
      }
    >
      <div className="card relative mb-6 aspect-video overflow-hidden bg-ink">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />
        {!modelsReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <p className="flex items-center gap-2 text-sm text-white">
              <ScanFace className="h-4 w-4 animate-pulse" /> Loading recognition models…
            </p>
          </div>
        )}
      </div>

      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Users className="h-4 w-4 text-ink-soft" /> Roster
      </h2>
      <ul className="space-y-2">
        {roster.map((s) => (
          <li key={s.id} className="card flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{s.full_name}</p>
              <p className="text-xs text-ink-faint">{s.reg_no}</p>
            </div>
            {marked.has(s.id) ? (
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-red" />
            ) : (
              <button
                onClick={() => markAttendance(s, null, 'manual')}
                className="flex items-center gap-1.5 rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:border-red hover:text-red"
              >
                <UserCheck className="h-3.5 w-3.5" /> Mark present
              </button>
            )}
          </li>
        ))}
      </ul>
    </Shell>
  )
}

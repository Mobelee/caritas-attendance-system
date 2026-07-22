import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as faceapi from 'face-api.js'
import { BookOpen, CalendarDays, Camera, CheckCircle2, Circle, Clock, Loader2, ScanFace, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Shell from '../../components/Shell'
import { useToast } from '../../hooks/useToast'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MODEL_URL = '/models/weights'
const MATCH_THRESHOLD = 0.5

export default function StudentDashboard({ profile }) {
  const [todayClasses, setTodayClasses] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [attendanceStatus, setAttendanceStatus] = useState(null) // null = loading, { marked: boolean, record: object }
  const [regNo, setRegNo] = useState('')
  const [loading, setLoading] = useState(true)

  // Face Scan Modal State
  const [showScanModal, setShowScanModal] = useState(false)

  const { push } = useToast()

  useEffect(() => {
    loadTodaySchedule()

    // Real-time subscriptions for class sessions AND attendance changes
    const sessionChannel = supabase
      .channel('student-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_sessions' }, () => {
        loadTodaySchedule()
      })
      .subscribe()

    const attendanceChannel = supabase
      .channel('student-attendance')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance', filter: `student_id=eq.${profile.id}` },
        () => {
          checkAttendanceForActiveSession()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sessionChannel)
      supabase.removeChannel(attendanceChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  async function loadTodaySchedule() {
    const dow = new Date().getDay()
    const today = new Date().toISOString().slice(0, 10)

    const { data: student } = await supabase
      .from('students')
      .select('reg_no, department_id, level')
      .eq('id', profile.id)
      .single()

    if (student) setRegNo(student.reg_no || '')

    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('course_id')
      .eq('student_id', profile.id)

    const courseIds = (enrollments ?? []).map((e) => e.course_id)

    if (courseIds.length > 0) {
      const { data: timetable } = await supabase
        .from('timetable')
        .select('id, start_time, end_time, venue, course:courses(id, code, title, lecturer:lecturers(id, profile:profiles(full_name)))')
        .eq('day_of_week', dow)
        .in('course_id', courseIds)
        .order('start_time')

      setTodayClasses(timetable ?? [])

      const { data: sessions } = await supabase
        .from('class_sessions')
        .select('*, course:courses(code, title)')
        .eq('session_date', today)
        .eq('status', 'active')
        .in('course_id', courseIds)

      const active = sessions?.[0] ?? null
      setActiveSession(active)

      if (active) {
        const { data: attRecord } = await supabase
          .from('attendance')
          .select('*')
          .eq('session_id', active.id)
          .eq('student_id', profile.id)
          .single()

        setAttendanceStatus(attRecord ? { marked: true, record: attRecord } : { marked: false, record: null })
      } else {
        setAttendanceStatus(null)
      }
    } else {
      setTodayClasses([])
      setActiveSession(null)
      setAttendanceStatus(null)
    }

    setLoading(false)
  }

  async function checkAttendanceForActiveSession() {
    if (!activeSession) return
    const { data: attRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', activeSession.id)
      .eq('student_id', profile.id)
      .single()

    setAttendanceStatus(attRecord ? { marked: true, record: attRecord } : { marked: false, record: null })
  }

  return (
    <Shell title={profile.full_name} subtitle={`Reg No: ${regNo || 'N/A'} · ${DAY_NAMES[new Date().getDay()]}`}>
      {/* Active Session Notification & Self-Mark Banner */}
      {activeSession && (
        <div className="mb-6 card p-5 border-l-4 border-l-red bg-canvas space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red" />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  {activeSession.course.code} — {activeSession.course.title}
                </p>
                <p className="text-xs text-ink-soft">Class session is currently ACTIVE</p>
              </div>
            </div>

            {attendanceStatus?.marked ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> Attendance Present
              </span>
            ) : (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                ● Pending Attendance
              </span>
            )}
          </div>

          {!attendanceStatus?.marked ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-line">
              <p className="text-xs text-ink-soft">
                Mark your attendance via face scan on your device or show your face to the lecturer's scanner.
              </p>
              <button
                onClick={() => setShowScanModal(true)}
                className="btn-primary w-full sm:w-auto text-xs whitespace-nowrap"
              >
                <ScanFace className="h-4 w-4" /> Scan Face & Mark Attendance
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-line text-xs text-green-700 font-medium">
              ✓ Marked present at {new Date(attendanceStatus.record.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({attendanceStatus.record.method})
            </div>
          )}
        </div>
      )}

      {/* Student Self Scan Modal */}
      {showScanModal && activeSession && (
        <StudentFaceScanModal
          studentId={profile.id}
          activeSession={activeSession}
          onClose={() => setShowScanModal(false)}
          onSuccess={() => {
            setShowScanModal(false)
            push('Attendance marked successfully!')
            checkAttendanceForActiveSession()
          }}
        />
      )}

      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <CalendarDays className="h-4 w-4 text-ink-soft" /> Today's classes
        </h2>
        <Link to="/courses" className="flex items-center gap-1.5 text-sm font-medium text-red">
          <BookOpen className="h-4 w-4" /> Manage courses
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading schedule…</p>
      ) : todayClasses.length === 0 ? (
        <div className="card p-6 text-center">
          <p className="text-sm text-ink-soft mb-3">No classes scheduled for today.</p>
          <Link to="/courses" className="btn-secondary mx-auto inline-flex items-center gap-2 text-xs">
            <BookOpen className="h-4 w-4" /> Register courses
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {todayClasses.map((slot) => {
            const isCurrentActive = activeSession?.course_id === slot.course.id
            return (
              <li key={slot.id} className="card flex items-center gap-4 p-4">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded ${
                    isCurrentActive ? 'bg-red text-white' : 'bg-canvas text-ink-soft'
                  }`}
                >
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">
                    {slot.course.code} · {slot.course.title}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} · {slot.venue || 'Venue TBA'} ·{' '}
                    {slot.course.lecturer?.profile?.full_name || 'Lecturer TBA'}
                  </p>
                </div>

                {isCurrentActive ? (
                  attendanceStatus?.marked ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                      <CheckCircle2 className="h-5 w-5" /> Present
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowScanModal(true)}
                      className="btn-primary text-xs px-2.5 py-1.5"
                    >
                      <ScanFace className="h-3.5 w-3.5" /> Scan
                    </button>
                  )
                ) : (
                  <Circle className="h-5 w-5 flex-shrink-0 text-line" />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Shell>
  )
}

/**
 * Student face verification modal component for active session attendance
 */
function StudentFaceScanModal({ studentId, activeSession, onClose, onSuccess }) {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [storedDescriptor, setStoredDescriptor] = useState(null)

  useEffect(() => {
    let stream
    ;(async () => {
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

      const { data: student } = await supabase
        .from('students')
        .select('face_descriptor')
        .eq('id', studentId)
        .single()

      if (student?.face_descriptor) {
        setStoredDescriptor(new Float32Array(student.face_descriptor))
      } else {
        setError('No face profile enrolled! Please enroll your face first in onboarding.')
      }

      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) videoRef.current.srcObject = stream
      setReady(true)
    })()

    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [studentId])

  async function handleScan() {
    if (!storedDescriptor) {
      setError('Enrolled face profile not found.')
      return
    }

    setError('')
    setScanning(true)

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor()

      if (!detection) {
        setError('No face detected. Please face the camera directly in good lighting.')
        setScanning(false)
        return
      }

      const distance = faceapi.euclideanDistance(detection.descriptor, storedDescriptor)

      if (distance < MATCH_THRESHOLD) {
        let saved = false
        const confidenceVal = Number((1 - distance).toFixed(4))

        const { error: insertError } = await supabase.from('attendance').upsert(
          {
            session_id: activeSession.id,
            student_id: studentId,
            marked_at: new Date().toISOString(),
            method: 'face_recognition',
            confidence: confidenceVal
          },
          { onConflict: 'session_id,student_id' }
        )

        if (!insertError) {
          saved = true
        } else {
          // Automatic fallback to backend service-role API endpoint
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/attendance/mark`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                session_id: activeSession.id,
                student_id: studentId,
                method: 'face_recognition',
                confidence: confidenceVal
              })
            })
            const data = await res.json()
            if (res.ok && data.ok) saved = true
          } catch (e) {
            console.error('Backend fallback error:', e)
          }
        }

        if (!saved) {
          setError('Could not save attendance record — please ask lecturer to mark manually.')
          setScanning(false)
          return
        }

        onSuccess?.()
      } else {
        setError('Face verification failed: descriptor does not match your enrolled profile.')
        setScanning(false)
      }
    } catch (err) {
      console.error(err)
      setError('Scanning error occurred. Please try again.')
      setScanning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">
            Mark Attendance — {activeSession.course.code}
          </h3>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative mb-4 aspect-square w-full max-w-xs mx-auto overflow-hidden rounded-full bg-ink">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
          {(!ready || scanning) && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/70">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>

        {error && <p className="mb-3 text-xs text-red font-medium">{error}</p>}

        <p className="mb-4 text-xs text-ink-soft">
          Position your face clearly in the circle to verify identity and mark attendance.
        </p>

        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 text-xs">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleScan}
            disabled={!ready || scanning || !storedDescriptor}
            className="btn-primary flex-1 text-xs"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Verify & Mark'}
          </button>
        </div>
      </div>
    </div>
  )
}

import { useNavigate } from 'react-router-dom'
import { ScanFace } from 'lucide-react'
import FaceEnroll from '../components/FaceEnroll'

export default function FaceEnrollment({ profile }) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-red">
          <ScanFace className="h-6 w-6 text-white" strokeWidth={2} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">One-time face enrolment</h1>
        <p className="mt-1 max-w-xs text-sm text-ink-soft">
          This lets attendance be marked automatically in class. It takes about 30 seconds.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <FaceEnroll studentId={profile.id} onDone={() => navigate('/')} />
      </div>
    </div>
  )
}

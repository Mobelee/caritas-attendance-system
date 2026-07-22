import { useEffect, useRef, useState } from 'react'
import * as faceapi from 'face-api.js'
import { Camera, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const MODEL_URL = '/models/weights'

/**
 * One-time capture used during onboarding. Takes 3 samples and averages
 * the descriptors for a steadier reference vector, then writes it to
 * students.face_descriptor.
 */
export default function FaceEnroll({ studentId, onDone }) {
  const videoRef = useRef(null)
  const [ready, setReady] = useState(false)
  const [samples, setSamples] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) videoRef.current.srcObject = stream
      setReady(true)
    })()
    return () => stream?.getTracks().forEach((t) => t.stop())
  }, [])

  async function capture() {
    setError('')
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor()

    if (!detection) {
      setError('No face detected. Face the camera in good light and try again.')
      return
    }
    setSamples((prev) => [...prev, detection.descriptor])
  }

  async function finish() {
    setSaving(true)
    // Average the samples into a single reference descriptor
    const length = samples[0].length
    const averaged = new Array(length).fill(0)
    samples.forEach((descriptor) => {
      for (let i = 0; i < length; i++) averaged[i] += descriptor[i] / samples.length
    })

    await supabase
      .from('students')
      .update({ face_descriptor: averaged, face_enrolled_at: new Date().toISOString() })
      .eq('id', studentId)

    setSaving(false)
    onDone?.()
  }

  return (
    <div className="card p-5">
      <div className="relative mb-4 aspect-square w-full max-w-xs mx-auto overflow-hidden rounded-full bg-ink">
        <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/80">
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>

      <p className="mb-3 text-center text-sm text-ink-soft">
        {samples.length}/3 samples captured — face the camera straight on
      </p>

      {error && <p className="mb-3 text-center text-sm text-red">{error}</p>}

      {samples.length < 3 ? (
        <button onClick={capture} disabled={!ready} className="btn-primary w-full">
          <Camera className="h-4 w-4" /> Capture sample {samples.length + 1}
        </button>
      ) : (
        <button onClick={finish} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Complete enrolment'}
        </button>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useHandLandmarker } from '../hooks/useHandLandmarker'
import { drawHands } from '../lib/drawHandSkeleton'
import { useProgress } from '../context/ProgressContext'
import type { DominantHand, FrameDetection } from '../types/asl'
import './WebcamPanel.css'

interface WebcamPanelProps {
  enabled: boolean
  onDetection?: (detection: FrameDetection | null) => void
  statusMessage?: string
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Camera is off.',
  'loading-model': 'Loading the hand-tracking model…',
  'requesting-camera': 'Requesting camera access…',
  running: 'Live',
  error: 'Something went wrong.',
}

const DOMINANT_HAND_OPTIONS: DominantHand[] = ['Left', 'Right']

export function WebcamPanel({ enabled, onDetection, statusMessage }: WebcamPanelProps) {
  const { progress, setDominantHand } = useProgress()
  const dominantHand = progress.dominantHand
  const { videoRef, detection, status, error, switchError, fps, cameras, activeDeviceId, selectCamera } =
    useHandLandmarker({ enabled, dominantHand })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    onDetection?.(detection)
  }, [detection, onDetection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // drawHands clears the frame itself, so an empty list is also "erase".
    drawHands(ctx, detection?.hands ?? [], canvas.width, canvas.height)
  }, [detection])

  return (
    <div className="webcam-panel">
      <div className="webcam-panel__stage">
        <video ref={videoRef} className="webcam-panel__video" muted playsInline />
        <canvas ref={canvasRef} width={640} height={480} className="webcam-panel__overlay" />
        {status !== 'running' && (
          <div className="webcam-panel__overlay-message">
            {status === 'error' ? (error ?? 'Something went wrong.') : STATUS_LABEL[status]}
          </div>
        )}
        <div className="webcam-panel__hud">
          {cameras.length > 1 && (
            <select
              className="webcam-panel__hud-control webcam-panel__camera-select"
              aria-label="Choose camera"
              value={activeDeviceId ?? ''}
              disabled={status !== 'running'}
              onChange={(event) => selectCamera(event.target.value)}
            >
              {cameras.map((camera, index) => (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {camera.label || `Camera ${index + 1}`}
                </option>
              ))}
            </select>
          )}
          <div
            className="webcam-panel__hud-control webcam-panel__hand-picker"
            role="group"
            aria-label="Which hand you sign with"
          >
            <span className="webcam-panel__hand-picker-label">I sign with</span>
            <span className="webcam-panel__hand-picker-options">
              {DOMINANT_HAND_OPTIONS.map((hand) => (
                <button
                  key={hand}
                  type="button"
                  className="webcam-panel__hand-option"
                  aria-pressed={dominantHand === hand}
                  onClick={() => setDominantHand(hand)}
                >
                  {hand}
                </button>
              ))}
            </span>
          </div>
        </div>
      </div>
      <div className="webcam-panel__footer">
        <span>{statusMessage ?? STATUS_LABEL[status]}</span>
        {status === 'running' && <span className="webcam-panel__fps">{fps} fps</span>}
      </div>
      {/* A failed camera switch leaves the previous camera running, so this is a
          non-blocking notice rather than the full-stage error overlay. */}
      {switchError && <p className="webcam-panel__switch-error">{switchError}</p>}
    </div>
  )
}

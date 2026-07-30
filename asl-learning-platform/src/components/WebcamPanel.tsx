import { useEffect, useRef } from 'react'
import { useHandLandmarker } from '../hooks/useHandLandmarker'
import { drawHandSkeleton } from '../lib/drawHandSkeleton'
import type { HandDetectionResult } from '../types/asl'
import './WebcamPanel.css'

interface WebcamPanelProps {
  enabled: boolean
  onDetection?: (detection: HandDetectionResult | null) => void
  statusMessage?: string
}

const STATUS_LABEL: Record<string, string> = {
  idle: 'Camera is off.',
  'loading-model': 'Loading the hand-tracking model…',
  'requesting-camera': 'Requesting camera access…',
  running: 'Live',
  error: 'Something went wrong.',
}

export function WebcamPanel({ enabled, onDetection, statusMessage }: WebcamPanelProps) {
  const { videoRef, detection, status, error, fps } = useHandLandmarker({ enabled, numHands: 1 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    onDetection?.(detection)
  }, [detection, onDetection])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (detection) {
      drawHandSkeleton(ctx, detection.landmarks, canvas.width, canvas.height)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
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
      </div>
      <div className="webcam-panel__footer">
        <span>{statusMessage ?? STATUS_LABEL[status]}</span>
        {status === 'running' && <span className="webcam-panel__fps">{fps} fps</span>}
      </div>
    </div>
  )
}

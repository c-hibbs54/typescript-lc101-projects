import { useEffect, useRef, useState, type RefObject } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import type { HandDetectionResult, Handedness } from '../types/asl'

export type HandLandmarkerStatus = 'idle' | 'loading-model' | 'requesting-camera' | 'running' | 'error'

export interface UseHandLandmarkerOptions {
  /** Max number of hands MediaPipe should track. Defaults to 1. */
  numHands?: number
  /**
   * When false (default true), the hook never touches the camera or loads the
   * model, and tears down anything already running. Pages that don't need
   * live video (Home, Learn) should leave this false/omitted.
   */
  enabled?: boolean
}

export interface UseHandLandmarkerResult {
  /** Attach to the `<video ref={videoRef} muted playsInline />` the caller renders. */
  videoRef: RefObject<HTMLVideoElement | null>
  detection: HandDetectionResult | null
  status: HandLandmarkerStatus
  error: string | null
  /** Rolling estimate of detection-loop frames per second over the last ~1s. */
  fps: number
}

const WASM_BASE_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm'
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const CAMERA_DENIED_MESSAGE =
  'Camera access was denied — allow camera permissions in your browser and reload this page to practice with live feedback.'
const CAMERA_UNAVAILABLE_MESSAGE =
  'Live hand tracking needs camera access, which requires this page to be served over HTTPS (or localhost) with camera permissions allowed.'
const CAMERA_GENERIC_MESSAGE = 'Could not access the camera — make sure a webcam is connected and reload this page.'
const MODEL_LOAD_MESSAGE = 'Could not load the hand-tracking model — check your connection and reload.'

/**
 * Owns webcam access and MediaPipe HandLandmarker setup/teardown so pages can
 * just render a `<video>` element and read live hand-landmark detections.
 *
 * Only requests the camera / loads the model while `options.enabled` is true;
 * fully tears down (stops tracks, cancels the rAF loop, closes the
 * landmarker) whenever it becomes disabled or the component unmounts.
 */
export function useHandLandmarker(options?: UseHandLandmarkerOptions): UseHandLandmarkerResult {
  const numHands = options?.numHands ?? 1
  const enabled = options?.enabled ?? true

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [detection, setDetection] = useState<HandDetectionResult | null>(null)
  const [status, setStatus] = useState<HandLandmarkerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)

  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const frameTimestampsRef = useRef<number[]>([])

  useEffect(() => {
    if (!enabled) {
      // Resetting to the idle snapshot when this effect is torn down/disabled,
      // not synchronizing per-render state — safe despite the lint rule below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('idle')
      setError(null)
      setDetection(null)
      setFps(0)
      return
    }

    let cancelled = false
    let attachedVideoEl: HTMLVideoElement | null = null

    const detectLoop = () => {
      if (cancelled) return
      const landmarker = handLandmarkerRef.current
      const videoEl = videoRef.current

      if (landmarker && videoEl && videoEl.readyState >= 2) {
        const now = performance.now()
        const result = landmarker.detectForVideo(videoEl, now)

        const timestamps = frameTimestampsRef.current
        timestamps.push(now)
        const cutoff = now - 1000
        while (timestamps.length > 0 && timestamps[0] < cutoff) {
          timestamps.shift()
        }
        setFps(timestamps.length)

        const firstHandLandmarks = result.landmarks[0]
        if (firstHandLandmarks && firstHandLandmarks.length > 0) {
          const handednessCategory = result.handedness[0]?.[0]
          setDetection({
            landmarks: firstHandLandmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
            handedness: (handednessCategory?.categoryName as Handedness | undefined) ?? 'Right',
            handednessScore: handednessCategory?.score ?? 0,
            timestampMs: now,
          })
        } else {
          setDetection(null)
        }
      }

      rafRef.current = requestAnimationFrame(detectLoop)
    }

    const setup = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('error')
        setError(CAMERA_UNAVAILABLE_MESSAGE)
        return
      }

      setStatus('loading-model')
      setError(null)

      let landmarker: HandLandmarker
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL)
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands,
          })
        } catch (gpuErr) {
          console.warn('HandLandmarker GPU delegate failed, retrying with CPU delegate', gpuErr)
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate: 'CPU' },
            runningMode: 'VIDEO',
            numHands,
          })
        }
      } catch (modelErr) {
        if (cancelled) return
        console.error('Failed to load hand-tracking model', modelErr)
        setStatus('error')
        setError(MODEL_LOAD_MESSAGE)
        return
      }

      if (cancelled) {
        landmarker.close()
        return
      }
      handLandmarkerRef.current = landmarker

      setStatus('requesting-camera')

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      } catch (camErr) {
        if (cancelled) return
        const name = camErr instanceof DOMException ? camErr.name : ''
        setStatus('error')
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          setError(CAMERA_DENIED_MESSAGE)
        } else {
          setError(CAMERA_GENERIC_MESSAGE)
        }
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const videoEl = videoRef.current
      attachedVideoEl = videoEl
      if (videoEl) {
        videoEl.srcObject = stream
        try {
          await videoEl.play()
        } catch (playErr) {
          // Some browsers momentarily reject play() (e.g. rapid mount/unmount);
          // the video usually starts anyway once attached, so don't surface this
          // as a hard error.
          console.warn('Video play() rejected', playErr)
        }
      }

      if (cancelled) return

      setStatus('running')
      frameTimestampsRef.current = []
      rafRef.current = requestAnimationFrame(detectLoop)
    }

    void setup()

    return () => {
      cancelled = true

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      if (handLandmarkerRef.current) {
        handLandmarkerRef.current.close()
        handLandmarkerRef.current = null
      }

      if (attachedVideoEl) {
        attachedVideoEl.srcObject = null
        attachedVideoEl = null
      }

      frameTimestampsRef.current = []
    }
  }, [enabled, numHands])

  return { videoRef, detection, status, error, fps }
}

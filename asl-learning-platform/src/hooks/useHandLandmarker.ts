import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { createHandRoleTracker, type HandRoleTracker, type UnroledHand } from '../lib/handRoles'
import type { DominantHand, FrameDetection, Handedness } from '../types/asl'

export type HandLandmarkerStatus = 'idle' | 'loading-model' | 'requesting-camera' | 'running' | 'error'

export interface UseHandLandmarkerOptions {
  /** Max number of hands MediaPipe should track. Defaults to 2 (main + supporting hand). */
  numHands?: number
  /**
   * When false (default true), the hook never touches the camera or loads the
   * model, and tears down anything already running. Pages that don't need
   * live video (Home, Learn) should leave this false/omitted.
   */
  enabled?: boolean
  /**
   * Hand the learner signs with; decides which detected hand is 'primary'
   * (drawn violet) and which is 'secondary' (drawn green). Defaults to 'Right'.
   * Passed in rather than read from app state so the hook stays independent of
   * ProgressContext. Changing it re-roles subsequent frames without touching
   * the camera or reloading the model.
   */
  dominantHand?: DominantHand
}

export interface UseHandLandmarkerResult {
  /** Attach to the `<video ref={videoRef} muted playsInline />` the caller renders. */
  videoRef: RefObject<HTMLVideoElement | null>
  /**
   * Every hand seen in the latest frame with roles already resolved
   * (`hands` is primary-first), or null when no hand was detected.
   */
  detection: FrameDetection | null
  status: HandLandmarkerStatus
  /**
   * Terminal, blocking problem with the live feed: permission denied, insecure
   * context, or the model failing to load. Only ever set together with
   * `status: 'error'`, i.e. there is nothing on screen to look at.
   */
  error: string | null
  /**
   * Non-blocking, transient failure of a `selectCamera` switch. The previous
   * camera is deliberately left running when a switch fails, so `status` stays
   * 'running' and the feed keeps working — surface this as a dismissible
   * notice (e.g. beside the camera picker), never as a full-stage error, and
   * keep the picker enabled so the learner can choose another camera. Cleared
   * on the next switch attempt and on the next successful switch.
   */
  switchError: string | null
  /** Rolling estimate of detection-loop frames per second over the last ~1s. */
  fps: number
  /**
   * Available video input devices (e.g. separate front/back or wide/ultrawide
   * lenses on a phone), populated after the first successful camera grant —
   * device labels are blank until permission has been granted at least once.
   * Empty until then, and whenever there's only one camera to choose from.
   */
  cameras: MediaDeviceInfo[]
  /** `deviceId` of the stream currently feeding the video element, if any. */
  activeDeviceId: string | null
  /**
   * Switch the live camera stream to a different device without reloading the
   * (expensive) HandLandmarker model. Safe to call at any time the camera is
   * running; a no-op if the camera isn't active or `deviceId` is already active.
   * A failed switch keeps the current camera live and reports via `switchError`.
   */
  selectCamera: (deviceId: string) => void
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
// Switching cameras is recoverable: the previous camera is still streaming, so
// this must not tell the learner to reload the page like the messages above do.
const CAMERA_SWITCH_FAILED_MESSAGE =
  'Could not switch to that camera — it may be in use by another app. Still using the previous camera.'

/**
 * Owns webcam access and MediaPipe HandLandmarker setup/teardown so pages can
 * just render a `<video>` element and read live hand-landmark detections.
 *
 * Tracks up to `numHands` hands per frame and runs them through a
 * `createHandRoleTracker` instance so the main (dominant) signing hand is
 * always identified as 'primary' regardless of the order MediaPipe returned
 * them in — that role, not detection order, is what the overlay colours and the
 * classifier key off. The tracker is stateful on purpose: it carries role
 * stickiness across frames so a single frame of flipped handedness can't swap
 * which hand is being graded.
 *
 * Only requests the camera / loads the model while `options.enabled` is true;
 * fully tears down (stops tracks, cancels the rAF loop, closes the
 * landmarker) whenever it becomes disabled or the component unmounts.
 */
export function useHandLandmarker(options?: UseHandLandmarkerOptions): UseHandLandmarkerResult {
  const numHands = options?.numHands ?? 2
  const enabled = options?.enabled ?? true
  const dominantHand = options?.dominantHand ?? 'Right'

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [detection, setDetection] = useState<FrameDetection | null>(null)
  const [status, setStatus] = useState<HandLandmarkerStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [fps, setFps] = useState(0)
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null)

  const handLandmarkerRef = useRef<HandLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const frameTimestampsRef = useRef<number[]>([])
  const activeDeviceIdRef = useRef<string | null>(null)
  // Every ref in this hook is shared by all runs of the setup effect, and
  // StrictMode dev-mounts that effect twice on the same hook instance
  // (setup A → cleanup A → setup B). A single shared boolean "cancelled" flag
  // therefore can't express liveness: cleanup A would set it and effect body B
  // would immediately clear it, so run A's awaited model-load / getUserMedia
  // resumptions would all conclude they're still live and go on to open a
  // second camera, landmarker and rAF loop that nothing ever tears down.
  // Instead each run claims a generation and only acts while it's the live one.
  const generationCounterRef = useRef(0)
  /** Generation of the effect run that owns the camera + model, or null when nothing is live. */
  const activeGenerationRef = useRef<number | null>(null)
  // Bumped on every selectCamera() call so a stale in-flight switch (e.g. the
  // user clicked two options quickly) can detect it's been superseded.
  const switchTokenRef = useRef(0)
  // Read by the rAF loop instead of being an effect dependency, so toggling
  // left/right dominance re-roles the very next frame without tearing down the
  // camera or reloading the model.
  const dominantHandRef = useRef<DominantHand>(dominantHand)
  // The live effect run's role tracker, exposed via a ref so `selectCamera`
  // (which lives outside the effect) can reset it when the stream changes.
  const trackerRef = useRef<HandRoleTracker | null>(null)

  useEffect(() => {
    dominantHandRef.current = dominantHand
    // Re-roles the next frame in place; no camera restart, no model reload.
    trackerRef.current?.setDominantHand(dominantHand)
  }, [dominantHand])

  // Re-enumerates video input devices and refreshes `cameras`. Only call this
  // after a successful getUserMedia() — device labels are blank before the
  // browser has granted camera permission at least once.
  const refreshCameraList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(devices.filter((device) => device.kind === 'videoinput'))
    } catch (enumErr) {
      console.warn('enumerateDevices failed', enumErr)
    }
  }, [])

  const selectCamera = useCallback(
    (deviceId: string) => {
      // Called from event handlers outside the effect, so liveness has to come
      // from a ref: no-op entirely once the hook is disabled or unmounted.
      const generation = activeGenerationRef.current
      if (generation === null) return
      if (!streamRef.current || !videoRef.current) return
      if (deviceId === activeDeviceIdRef.current) return

      const myToken = ++switchTokenRef.current
      // Still both the live effect run and the newest switch attempt?
      const isCurrent = () => activeGenerationRef.current === generation && switchTokenRef.current === myToken

      // A fresh attempt supersedes whatever the previous one reported.
      setSwitchError(null)

      const run = async () => {
        let newStream: MediaStream
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false,
          })
        } catch (switchErr) {
          console.error('Failed to switch camera', switchErr)
          if (!isCurrent()) return
          // The previous stream is still running (see below), so the feed is
          // *not* broken: leaving status at 'running' keeps the picker enabled
          // and keeps the full-stage error overlay off a working video.
          const name = switchErr instanceof DOMException ? switchErr.name : ''
          const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
          setSwitchError(denied ? CAMERA_DENIED_MESSAGE : CAMERA_SWITCH_FAILED_MESSAGE)
          return
        }

        if (!isCurrent()) {
          newStream.getTracks().forEach((track) => track.stop())
          return
        }

        // Only stop the old tracks once the new stream is confirmed good, so
        // a failed switch leaves the previous camera feed intact.
        streamRef.current?.getTracks().forEach((track) => track.stop())
        streamRef.current = newStream
        setDetection(null)
        // A different lens/framing can show entirely different hands, so
        // cross-frame role stickiness has to start over.
        trackerRef.current?.reset()

        const videoEl = videoRef.current
        if (videoEl) {
          videoEl.srcObject = newStream
          try {
            await videoEl.play()
          } catch (playErr) {
            console.warn('Video play() rejected during camera switch', playErr)
          }
        }

        if (!isCurrent()) return

        const actualDeviceId = newStream.getVideoTracks()[0]?.getSettings().deviceId ?? deviceId
        activeDeviceIdRef.current = actualDeviceId
        setActiveDeviceId(actualDeviceId)
        setSwitchError(null)
        setStatus('running')

        void refreshCameraList()
      }

      void run()
    },
    [refreshCameraList],
  )

  useEffect(() => {
    if (!enabled) {
      activeGenerationRef.current = null
      activeDeviceIdRef.current = null
      // Resetting to the idle snapshot when this effect is torn down/disabled,
      // not synchronizing per-render state — safe despite the lint rule below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('idle')
      setError(null)
      setSwitchError(null)
      setDetection(null)
      setFps(0)
      setCameras([])
      setActiveDeviceId(null)
      return
    }

    const generation = ++generationCounterRef.current
    activeGenerationRef.current = generation
    /** True only while this effect run is the one that owns the camera + model. */
    const isCurrent = () => activeGenerationRef.current === generation

    // One tracker per effect run: its cross-frame state must not outlive the
    // camera/model it was built for. Seeded from the ref so `dominantHand`
    // stays out of this effect's dependency array.
    const tracker = createHandRoleTracker(dominantHandRef.current)
    trackerRef.current = tracker

    let attachedVideoEl: HTMLVideoElement | null = null

    const detectLoop = () => {
      // Bail without rescheduling if this run has been superseded, so a stale
      // loop can never keep calling detectForVideo (or clobber rafRef).
      if (!isCurrent()) return
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

        const unroled: UnroledHand[] = []
        result.landmarks.forEach((handLandmarks, index) => {
          if (!handLandmarks || handLandmarks.length === 0) return
          const handednessCategory = result.handedness[index]?.[0]
          unroled.push({
            landmarks: handLandmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z })),
            handedness: (handednessCategory?.categoryName as Handedness | undefined) ?? 'Right',
            handednessScore: handednessCategory?.score ?? 0,
            timestampMs: now,
          })
        })

        if (unroled.length > 0) {
          const hands = tracker.assign(unroled)
          setDetection({
            hands,
            primary: hands.find((hand) => hand.role === 'primary') ?? null,
            secondary: hands.find((hand) => hand.role === 'secondary') ?? null,
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
        if (!isCurrent()) return
        console.error('Failed to load hand-tracking model', modelErr)
        setStatus('error')
        setError(MODEL_LOAD_MESSAGE)
        return
      }

      // Nothing between this check and the publish below may await, so the
      // landmarker this run created is either handed to the live refs or
      // closed here — never orphaned.
      if (!isCurrent()) {
        landmarker.close()
        return
      }
      handLandmarkerRef.current = landmarker

      setStatus('requesting-camera')

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
      } catch (camErr) {
        if (!isCurrent()) return
        const name = camErr instanceof DOMException ? camErr.name : ''
        setStatus('error')
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
          setError(CAMERA_DENIED_MESSAGE)
        } else {
          setError(CAMERA_GENERIC_MESSAGE)
        }
        return
      }

      // Same rule as the landmarker: publish or stop, with no await between.
      if (!isCurrent()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream

      const initialDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null
      activeDeviceIdRef.current = initialDeviceId
      setActiveDeviceId(initialDeviceId)
      // Labels are only populated once permission has been granted, so this
      // is the earliest point enumerating devices is useful.
      await refreshCameraList()
      if (!isCurrent()) return

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

      if (!isCurrent()) return

      setStatus('running')
      frameTimestampsRef.current = []
      rafRef.current = requestAnimationFrame(detectLoop)
    }

    void setup()

    return () => {
      // Retire this generation: every in-flight await in setup()/detectLoop
      // above now fails isCurrent() and releases whatever it holds itself.
      if (activeGenerationRef.current === generation) activeGenerationRef.current = null
      activeDeviceIdRef.current = null

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

      tracker.reset()
      if (trackerRef.current === tracker) trackerRef.current = null
      frameTimestampsRef.current = []
    }
  }, [enabled, numHands, refreshCameraList])

  return { videoRef, detection, status, error, switchError, fps, cameras, activeDeviceId, selectCamera }
}

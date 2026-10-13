# SignJutsu — learn ASL fingerspelling with your webcam

SignJutsu is a browser-only ASL (American Sign Language) fingerspelling tutor. It uses your webcam and an
on-device hand-tracking model to give you real-time feedback on whether your handshape matches the letter
you're practicing — no video is ever uploaded anywhere.

## Why this stack

Everything runs client-side, in the browser, which is the most efficient architecture for this kind of app:

- **TypeScript + React + Vite** — a strongly-typed, component-based UI with near-instant dev rebuilds and a
  small, fast production bundle. TypeScript's static types keep the hand-tracking data, curriculum content, and
  classifier contracts consistent across the whole app.
- **MediaPipe Tasks Vision (`HandLandmarker`)** — Google's hand-landmark model, compiled to WebAssembly/WebGL
  and run entirely in the browser. It finds 21 3D points on a detected hand at real-time frame rates without
  any server round trip, which keeps latency low and your camera feed completely private (it never leaves your
  device).
- **A geometric classifier** (`src/lib/classifier.ts`) — rather than requiring a large labeled training set,
  static ASL letters are recognized from the 21 landmarks using finger-curl angles and normalized distances,
  matched against hand-crafted per-letter prototypes. Most of this feature set is deliberately rotation/scale
  invariant, plus one feature (`handOrientation`) that intentionally isn't - it's what lets the classifier tell
  apart letter pairs that are the same handshape rotated in space (G/Q, H/U, K/P). This is intentionally
  lightweight (no model download beyond the hand-tracker itself) and transparent — the UI shows the
  classifier's top 3 guesses and their confidence, rather than pretending a single number is ground truth.
- **No backend** — progress is stored in `localStorage`. The whole app is static and can be deployed to any
  static host (GitHub Pages, Netlify, Vercel, S3, ...) for effectively zero marginal cost per user.

## Getting started

```bash
npm install
npm run dev       # start the dev server (needs a webcam + HTTPS or localhost for camera access)
npm run build     # type-check and produce a production build in dist/
npm run test      # run the classifier's unit tests
npm run lint      # eslint
```

The webcam features require a secure context (localhost is fine for development; a real deployment needs
HTTPS) and the user granting camera permission when prompted.

## Project layout

```
src/
  types/asl.ts          shared contracts (landmarks, classification results, curriculum, progress)
  data/curriculum.ts     ASL alphabet + word-sign content, curriculum units, practice word list
  lib/classifier.ts      geometric hand-shape classifier (pure functions, unit tested)
  lib/drawHandSkeleton.ts canvas overlay drawing for the live hand skeleton
  hooks/useHandLandmarker.ts   webcam + MediaPipe integration as a React hook
  hooks/useSustainedMatch.ts   "hold the shape for N ms to confirm" logic shared by Practice/Quiz
  context/ProgressContext.tsx  localStorage-backed progress tracking
  components/            Navbar, WebcamPanel, CandidateList, LetterCard, ProgressBar
  pages/                 Home, Learn, Practice, Quiz, Progress
```

## Known limitations

- The classifier is rule-based, not a trained deep-learning model. M/N/S/T are all near-fist shapes that
  differ only in subtle thumb position and remain the hardest group to tell apart (N/S especially - the
  classifier's own regression tests only assert they're *distinguishable*, not easy to tell apart), especially
  in poor lighting or unusual hand angles. Practice mode surfaces this honestly by showing the top 3 candidates
  and their confidence, and only confirms a letter once the top match holds steady for a short duration -
  though that confirmation currently doesn't require the top match to beat the runner-up by any margin, so a
  genuinely borderline match can still get the same unqualified "nice!" as a confident one.
- **J** and **Z** involve in-air motion and cannot be recognized by a single-frame classifier; they're still
  taught in the Learn section but are excluded from live practice/quiz recognition.
- This app teaches the fingerspelling alphabet and a couple of common signs as a starting point. ASL is a full,
  rich language with its own grammar and non-manual markers (facial expression, movement, space) — it is not
  just English spelled out letter by letter. Learners aiming for real fluency should seek out Deaf instructors
  and the Deaf community; see the note on the home page.

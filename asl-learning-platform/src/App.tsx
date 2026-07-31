import { Route, Routes, useLocation } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { AmbientBackground } from './components/AmbientBackground'
import { ProgressProvider } from './context/ProgressContext'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { PracticePage } from './pages/PracticePage'
import { QuizPage } from './pages/QuizPage'
import { SpellPage } from './pages/SpellPage'
import { ProgressPage } from './pages/ProgressPage'

/** Routes that run the webcam + hand-tracking model, and so want the cheap background. */
const CAMERA_ROUTES = ['/practice', '/quiz', '/spell']

function App() {
  const { pathname } = useLocation()
  const onCameraRoute = CAMERA_ROUTES.includes(pathname)

  return (
    <ProgressProvider>
      <AmbientBackground variant={onCameraRoute ? 'calm' : 'full'} />
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/spell" element={<SpellPage />} />
            <Route path="/progress" element={<ProgressPage />} />
          </Routes>
        </main>
      </div>
    </ProgressProvider>
  )
}

export default App

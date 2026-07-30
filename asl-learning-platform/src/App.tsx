import { Route, Routes } from 'react-router-dom'
import { Navbar } from './components/Navbar'
import { ProgressProvider } from './context/ProgressContext'
import { HomePage } from './pages/HomePage'
import { LearnPage } from './pages/LearnPage'
import { PracticePage } from './pages/PracticePage'
import { QuizPage } from './pages/QuizPage'
import { ProgressPage } from './pages/ProgressPage'

function App() {
  return (
    <ProgressProvider>
      <div className="app-shell">
        <Navbar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/learn" element={<LearnPage />} />
            <Route path="/practice" element={<PracticePage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/progress" element={<ProgressPage />} />
          </Routes>
        </main>
      </div>
    </ProgressProvider>
  )
}

export default App

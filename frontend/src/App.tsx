import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Box from '@mui/material/Box'
import BrainPage from './pages/BrainPage'
import NeuralLoader from './components/NeuralLoader'

// Globe + Story pull in three.js — lazy-load so the Brain view stays light.
const GlobePage = lazy(() => import('./pages/GlobePage'))
const StoryPage = lazy(() => import('./pages/StoryPage'))
const QuotePage = lazy(() => import('./pages/QuotePage'))

export default function App() {
  return (
    <Suspense
      fallback={
        <Box sx={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
          <NeuralLoader label="Waking the brain…" />
        </Box>
      }
    >
      <Routes>
        <Route path="/" element={<BrainPage />} />
        <Route path="/globe" element={<GlobePage />} />
        <Route path="/story/:founderId" element={<StoryPage />} />
        <Route path="/quote" element={<QuotePage />} />
      </Routes>
    </Suspense>
  )
}

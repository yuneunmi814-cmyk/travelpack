import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { SpotsListPage } from './pages/SpotsListPage'
import { SpotFormPage } from './pages/SpotFormPage'
import { CoursesListPage } from './pages/CoursesListPage'
import { CourseFormPage } from './pages/CourseFormPage'
import { UsersPage } from './pages/UsersPage'
import { ReportsPage } from './pages/ReportsPage'
import { BannersPage } from './pages/BannersPage'
import { PushPage } from './pages/PushPage'
import { SettlementsPage } from './pages/SettlementsPage'

export function App() {
  const { isAuthed } = useAuth()
  if (!isAuthed) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/spots" element={<SpotsListPage />} />
        <Route path="/spots/new" element={<SpotFormPage />} />
        <Route path="/spots/:id" element={<SpotFormPage />} />
        <Route path="/courses" element={<CoursesListPage />} />
        <Route path="/courses/new" element={<CourseFormPage />} />
        <Route path="/courses/:id" element={<CourseFormPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="/push" element={<PushPage />} />
        <Route path="/settlements" element={<SettlementsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

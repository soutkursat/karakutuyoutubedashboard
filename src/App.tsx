import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import { AppShell } from './components/AppShell'
import { Guard, homeFor } from './components/Guard'
import { IconCalendar, IconCalendarPlus, IconClock, IconHome, IconSettings, IconUser, IconUsers } from './components/Icons'
import { AuthPage } from './pages/AuthPage'
import { StudentHome } from './pages/student/StudentHome'
import { BookPage } from './pages/student/BookPage'
import { MyAppointments } from './pages/student/MyAppointments'
import { ProfilePage } from './pages/ProfilePage'
import { AdminHome } from './pages/admin/AdminHome'
import { AdminAppointments } from './pages/admin/AdminAppointments'
import { AdminAvailability } from './pages/admin/AdminAvailability'
import { AdminStudents } from './pages/admin/AdminStudents'
import { AdminSettings } from './pages/admin/AdminSettings'
import { currentUser, getAppointments, isReady } from './lib/db'
import { isConfigured } from './lib/supabase'
import { Loader, SetupScreen } from './components/Screens'
import { useDataVersion } from './lib/hooks'

function RootRedirect() {
  useDataVersion()
  if (!isReady()) return <Loader />
  return <Navigate to={homeFor(currentUser())} replace />
}

export function App() {
  useDataVersion()
  const pending = getAppointments().filter((a) => a.status === 'pending' && new Date(a.end).getTime() > Date.now()).length

  if (!isConfigured) {
    return (
      <>
        <div className="bg-fx" aria-hidden />
        <SetupScreen />
      </>
    )
  }

  return (
    <ToastProvider>
      <div className="bg-fx" aria-hidden />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/giris" element={<AuthPage />} />

          <Route
            path="/panel"
            element={
              <Guard role="student">
                {(u) => (
                  <AppShell
                    user={u}
                    area="Öğrenci Paneli"
                    nav={[
                      { to: '/panel', label: 'Genel Bakış', icon: <IconHome />, end: true },
                      { to: '/panel/randevu-al', label: 'Randevu Al', icon: <IconCalendarPlus /> },
                      { to: '/panel/randevularim', label: 'Randevularım', icon: <IconCalendar /> },
                      { to: '/panel/profil', label: 'Profilim', icon: <IconUser /> },
                    ]}
                  />
                )}
              </Guard>
            }
          >
            <Route index element={<StudentHome />} />
            <Route path="randevu-al" element={<BookPage />} />
            <Route path="randevularim" element={<MyAppointments />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>

          <Route
            path="/yonetim"
            element={
              <Guard role="admin">
                {(u) => (
                  <AppShell
                    user={u}
                    area="Yönetim Paneli"
                    nav={[
                      { to: '/yonetim', label: 'Genel Bakış', icon: <IconHome />, end: true },
                      { to: '/yonetim/randevular', label: 'Randevular', icon: <IconCalendar />, badge: pending },
                      { to: '/yonetim/musaitlik', label: 'Müsaitlik', icon: <IconClock /> },
                      { to: '/yonetim/ogrenciler', label: 'Öğrenciler', icon: <IconUsers /> },
                      { to: '/yonetim/ayarlar', label: 'Ayarlar', icon: <IconSettings /> },
                      { to: '/yonetim/profil', label: 'Hesabım', icon: <IconUser /> },
                    ]}
                  />
                )}
              </Guard>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="randevular" element={<AdminAppointments />} />
            <Route path="musaitlik" element={<AdminAvailability />} />
            <Route path="ogrenciler" element={<AdminStudents />} />
            <Route path="ayarlar" element={<AdminSettings />} />
            <Route path="profil" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}

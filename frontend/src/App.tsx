// App根组件
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ToastProvider } from '@/components/ui/toast'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'

// 懒加载页面组件
import { lazy, Suspense } from 'react'

const DiaryList = lazy(() => import('@/pages/diaries/DiaryList'))
const DiaryDetail = lazy(() => import('@/pages/diaries/DiaryDetail'))
const DiaryEditor = lazy(() => import('@/pages/diaries/DiaryEditor'))
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const Timeline = lazy(() => import('@/pages/timeline/Timeline'))
const AnalysisResult = lazy(() => import('@/pages/analysis/AnalysisResult'))
const ProfileSettings = lazy(() => import('@/pages/settings/ProfileSettings'))

// 私有路由组件
function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

// 公共路由组件（已登录用户不能访问）
function PublicRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated } = useAuthStore()

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  const { checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <ToastProvider>
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        }
      >
        <Routes>
          {/* 公开路由 */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicRoute>
                <RegisterPage />
              </PublicRoute>
            }
          />

          {/* 私有路由 */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/diaries"
            element={
              <PrivateRoute>
                <DiaryList />
              </PrivateRoute>
            }
          />
          <Route
            path="/diaries/:id"
            element={
              <PrivateRoute>
                <DiaryDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/diaries/new"
            element={
              <PrivateRoute>
                <DiaryEditor />
              </PrivateRoute>
            }
          />
          <Route
            path="/diaries/:id/edit"
            element={
              <PrivateRoute>
                <DiaryEditor />
              </PrivateRoute>
            }
          />
          <Route
            path="/timeline"
            element={
              <PrivateRoute>
                <Timeline />
              </PrivateRoute>
            }
          />
          <Route
            path="/analysis/:id"
            element={
              <PrivateRoute>
                <AnalysisResult />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <ProfileSettings />
              </PrivateRoute>
            }
          />

          {/* 404页面 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
    </ToastProvider>
  )
}

export default App

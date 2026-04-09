// App根组件
import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { ToastProvider } from '@/components/ui/toast'
import YinjiSprite from '@/components/assistant/YinjiSprite'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import LandingPage from '@/pages/LandingPage'

// 懒加载页面组件
import { lazy, Suspense } from 'react'

const DiaryList = lazy(() => import('@/pages/diaries/DiaryList'))
const DiaryDetail = lazy(() => import('@/pages/diaries/DiaryDetail'))
const DiaryEditor = lazy(() => import('@/pages/diaries/DiaryEditor'))
const Dashboard = lazy(() => import('@/pages/dashboard/Dashboard'))
const GrowthCenter = lazy(() => import('@/pages/timeline/Timeline'))
const AnalysisOverview = lazy(() => import('@/pages/analysis/AnalysisOverview'))
const ProfileSettings = lazy(() => import('@/pages/settings/ProfileSettings'))
const PrivacyPolicy = lazy(() => import('@/pages/legal/PrivacyPolicy'))
const TermsOfService = lazy(() => import('@/pages/legal/TermsOfService'))
const RefundPolicy = lazy(() => import('@/pages/legal/RefundPolicy'))
const CommunityPage = lazy(() => import('@/pages/community/CommunityPage'))
const CreatePostPage = lazy(() => import('@/pages/community/CreatePostPage'))
const PostDetailPage = lazy(() => import('@/pages/community/PostDetailPage'))
const CollectionsPage = lazy(() => import('@/pages/community/CollectionsPage'))
const HistoryPage = lazy(() => import('@/pages/community/HistoryPage'))
const EmotionMap = lazy(() => import('@/pages/emotion/EmotionMap'))

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
    return <Navigate to="/welcome" replace />
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

function AppRoutes() {
  const { checkAuth } = useAuthStore()
  const location = useLocation()

  const hideSpritePaths = new Set([
    '/welcome',
    '/login',
    '/register',
    '/forgot-password',
    '/privacy',
    '/terms',
    '/refund',
  ])
  const showSprite = !hideSpritePaths.has(location.pathname)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
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
            path="/welcome"
            element={
              <PublicRoute>
                <LandingPage />
              </PublicRoute>
            }
          />
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
          <Route
            path="/forgot-password"
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            }
          />

          {/* 法律政策页面（无需登录） */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/refund" element={<RefundPolicy />} />

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
            path="/growth"
            element={
              <PrivateRoute>
                <GrowthCenter />
              </PrivateRoute>
            }
          />
          <Route path="/timeline" element={<Navigate to="/growth" replace />} />
          <Route
            path="/analysis"
            element={
              <PrivateRoute>
                <AnalysisOverview />
              </PrivateRoute>
            }
          />
          <Route
            path="/analysis/:id"
            element={<Navigate to="/analysis" replace />}
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <ProfileSettings />
              </PrivateRoute>
            }
          />

          {/* 情绪星图 */}
          <Route
            path="/emotion"
            element={
              <PrivateRoute>
                <EmotionMap />
              </PrivateRoute>
            }
          />

          {/* 社区路由 */}
          <Route
            path="/community"
            element={
              <PrivateRoute>
                <CommunityPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/community/new"
            element={
              <PrivateRoute>
                <CreatePostPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/community/post/:id"
            element={
              <PrivateRoute>
                <PostDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/community/collections"
            element={
              <PrivateRoute>
                <CollectionsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/community/history"
            element={
              <PrivateRoute>
                <HistoryPage />
              </PrivateRoute>
            }
          />

          {/* 404页面 */}
          <Route path="*" element={<Navigate to="/welcome" replace />} />
      </Routes>
      {showSprite ? <YinjiSprite /> : null}
    </Suspense>
  )
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  )
}

export default App

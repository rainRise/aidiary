// 路由配置
export const routes = {
  // 公开路由
  login: '/login',
  register: '/register',

  // 私有路由
  home: '/',
  diaries: '/diaries',
  diaryDetail: (id: number) => `/diaries/${id}`,
  diaryCreate: '/diaries/new',
  diaryEdit: (id: number) => `/diaries/${id}/edit`,
  analysis: '/analysis',
  analysisResult: (id: number) => `/analysis/${id}`,
  growth: '/growth',
  timeline: '/growth',
  dashboard: '/dashboard',
  settings: '/settings',
} as const

export const publicRoutes = [routes.login, routes.register]

export const privateRoutes = [
  routes.home,
  routes.diaries,
  routes.diaryCreate,
  routes.analysis,
  routes.timeline,
  routes.dashboard,
  routes.settings,
]

// 管理后台主页面
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { adminService } from '@/services/admin.service'
import type { AdminDashboardResponse, CounselorApplicationResponse, AdminUserResponse } from '@/types/auth'

// 角色显示名
const roleLabels: Record<string, string> = {
  student: '学生',
  counselor: '辅导员',
  psychologist: '心理老师',
  admin: '管理员',
}

const statusLabels: Record<string, { text: string; color: string }> = {
  pending: { text: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  approved: { text: '已通过', color: 'bg-green-100 text-green-800' },
  rejected: { text: '已拒绝', color: 'bg-red-100 text-red-800' },
}

export default function AdminPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'dashboard' | 'applications' | 'users' | 'posts'>('dashboard')
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null)
  const [applications, setApplications] = useState<CounselorApplicationResponse[]>([])
  const [users, setUsers] = useState<AdminUserResponse[]>([])
  const [loading, setLoading] = useState(false)

  // 非 admin 角色跳转
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // 加载看板数据
  useEffect(() => {
    if (tab === 'dashboard') loadDashboard()
    else if (tab === 'applications') loadApplications()
    else if (tab === 'users') loadUsers()
    else if (tab === 'posts') loadPosts()
  }, [tab])

  async function loadDashboard() {
    setLoading(true)
    try {
      const data = await adminService.getDashboard()
      setDashboard(data)
    } catch (e) {
      console.error('Failed to load dashboard', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadApplications() {
    setLoading(true)
    try {
      const data = await adminService.listApplications({ page_size: 50 })
      setApplications(data.items)
    } catch (e) {
      console.error('Failed to load applications', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadUsers() {
    setLoading(true)
    try {
      const data = await adminService.listUsers({ page_size: 50 })
      setUsers(data.items)
    } catch (e) {
      console.error('Failed to load users', e)
    } finally {
      setLoading(false)
    }
  }

  async function loadPosts() {
    setLoading(true)
    try {
      // 暂用 adminService.listPosts
      await adminService.listPosts({ page_size: 50 })
    } catch (e) {
      console.error('Failed to load posts', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleReview(id: number, action: 'approve' | 'reject') {
    try {
      await adminService.reviewApplication(id, { action })
      loadApplications()
    } catch (e) {
      console.error('Review failed', e)
    }
  }

  if (!user || user.role !== 'admin') return null

  const tabs = [
    { key: 'dashboard' as const, label: '系统看板' },
    { key: 'applications' as const, label: '认证审核' },
    { key: 'users' as const, label: '用户管理' },
    { key: 'posts' as const, label: '帖子管理' },
  ]

  return (
    <div className="min-h-screen bg-stone-50">
      {/* 顶栏 */}
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-800">映记管理后台</h1>
        <button
          onClick={() => navigate('/')}
          className="text-sm text-stone-500 hover:text-stone-700"
        >
          返回前台
        </button>
      </header>

      {/* 标签页 */}
      <nav className="bg-white border-b border-stone-200 px-6 flex gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-stone-800 text-stone-800'
                : 'border-transparent text-stone-500 hover:text-stone-700'
            }`}
          >
            {t.label}
            {t.key === 'applications' && dashboard && dashboard.pending_applications > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {dashboard.pending_applications}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* 内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-stone-300 border-t-stone-800 rounded-full" />
          </div>
        )}

        {!loading && tab === 'dashboard' && dashboard && (
          <DashboardView data={dashboard} />
        )}
        {!loading && tab === 'applications' && (
          <ApplicationsView
            items={applications}
            onReview={handleReview}
          />
        )}
        {!loading && tab === 'users' && (
          <UsersView items={users} />
        )}
        {!loading && tab === 'posts' && (
          <PostsView />
        )}
      </main>
    </div>
  )
}

// ==================== 子组件 ====================

function DashboardView({ data }: { data: AdminDashboardResponse }) {
  const cards = [
    { label: '总用户', value: data.total_users, sub: `活跃 ${data.active_users}` },
    { label: '辅导员', value: data.counselor_count },
    { label: '心理老师', value: data.psychologist_count },
    { label: '总日记', value: data.total_diaries },
    { label: '总帖子', value: data.total_posts, sub: `匿名 ${data.anonymous_posts}` },
    { label: '待审核', value: data.pending_applications },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="text-sm text-stone-500">{c.label}</div>
          <div className="text-2xl font-semibold text-stone-800 mt-1">{c.value}</div>
          {c.sub && <div className="text-xs text-stone-400 mt-1">{c.sub}</div>}
        </div>
      ))}
    </div>
  )
}

function ApplicationsView({
  items,
  onReview,
}: {
  items: CounselorApplicationResponse[]
  onReview: (id: number, action: 'approve' | 'reject') => void
}) {
  if (items.length === 0) {
    return <div className="text-center text-stone-400 py-20">暂无认证申请</div>
  }

  return (
    <div className="space-y-3">
      {items.map((app) => {
        const st = statusLabels[app.status] || { text: app.status, color: 'bg-stone-100 text-stone-600' }
        return (
          <div key={app.id} className="bg-white rounded-xl border border-stone-200 p-5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-stone-800">{app.real_name}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${st.color}`}>{st.text}</span>
                  <span className="text-xs text-stone-400">
                    {app.target_role === 'counselor' ? '辅导员' : '心理老师'}
                  </span>
                </div>
                <div className="mt-2 text-sm text-stone-500 space-y-0.5">
                  <div>院系：{app.department} {app.employee_id && `· 工号：${app.employee_id}`}</div>
                  <div>申请账号：{app.user_email || `用户#${app.user_id}`} {app.phone && `· ${app.phone}`}</div>
                  {app.introduction && <div className="text-stone-400">说明：{app.introduction}</div>}
                  {app.review_comment && <div className="text-stone-400">审核意见：{app.review_comment}</div>}
                </div>
              </div>
              {app.status === 'pending' && (
                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => onReview(app.id, 'approve')}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    通过
                  </button>
                  <button
                    onClick={() => onReview(app.id, 'reject')}
                    className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function UsersView({ items }: { items: AdminUserResponse[] }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const filtered = items.filter((u) => {
    if (search && !u.email.includes(search) && !(u.username || '').includes(search)) return false
    if (roleFilter && u.role !== roleFilter) return false
    return true
  })

  return (
    <div>
      {/* 筛选 */}
      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="搜索邮箱/用户名"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm flex-1"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-stone-300 rounded-lg text-sm"
        >
          <option value="">全部角色</option>
          <option value="student">学生</option>
          <option value="counselor">辅导员</option>
          <option value="psychologist">心理老师</option>
          <option value="admin">管理员</option>
        </select>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th className="text-left px-4 py-3 text-stone-500 font-medium">用户</th>
              <th className="text-left px-4 py-3 text-stone-500 font-medium">角色</th>
              <th className="text-left px-4 py-3 text-stone-500 font-medium">状态</th>
              <th className="text-left px-4 py-3 text-stone-500 font-medium">绑定范围</th>
              <th className="text-left px-4 py-3 text-stone-500 font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-stone-800">{u.username || '-'}</div>
                  <div className="text-xs text-stone-400">{u.email}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 text-xs rounded-full bg-stone-100 text-stone-600">
                    {roleLabels[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${u.is_active ? 'text-green-600' : 'text-red-500'}`}>
                    {u.is_active ? '活跃' : '禁用'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-stone-400">
                  {u.bindings.length > 0
                    ? u.bindings.map((b) => b.scope_name).join('、')
                    : '-'}
                </td>
                <td className="px-4 py-3 text-xs text-stone-400">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-stone-400 py-10">暂无数据</div>
        )}
      </div>
    </div>
  )
}

function PostsView() {
  // 帖子管理页面 - 后续迭代完善
  return (
    <div className="text-center text-stone-400 py-20">
      帖子管理功能开发中...
    </div>
  )
}

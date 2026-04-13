// 辅导员/心理老师认证申请页面
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { counselorService } from '@/services/admin.service'

export default function CounselorApplyPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [targetRole, setTargetRole] = useState<'counselor' | 'psychologist'>('counselor')
  const [realName, setRealName] = useState('')
  const [department, setDepartment] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [phone, setPhone] = useState('')
  const [introduction, setIntroduction] = useState('')
  const [bindings, setBindings] = useState<{ scope_type: 'department' | 'class'; scope_name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function addBinding() {
    setBindings([...bindings, { scope_type: 'department', scope_name: '' }])
  }

  function removeBinding(index: number) {
    setBindings(bindings.filter((_, i) => i !== index))
  }

  function updateBinding(index: number, field: 'scope_type' | 'scope_name', value: string) {
    const updated = [...bindings]
    updated[index] = { ...updated[index], [field]: value }
    setBindings(updated)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!realName.trim() || !department.trim()) {
      setError('请填写真实姓名和所属院系')
      return
    }

    const validBindings = bindings.filter((b) => b.scope_name.trim())
    if (validBindings.length === 0) {
      setError('请至少添加一个绑定范围（院系或班级）')
      return
    }

    setSubmitting(true)
    try {
      await counselorService.apply({
        target_role: targetRole,
        real_name: realName.trim(),
        department: department.trim(),
        employee_id: employeeId.trim() || undefined,
        phone: phone.trim() || undefined,
        introduction: introduction.trim() || undefined,
        bindings: validBindings,
      })
      navigate('/settings')
    } catch (err: any) {
      setError(err.response?.data?.detail || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 已是辅导员/心理老师，无需申请
  if (user?.role === 'counselor' || user?.role === 'psychologist') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✅</div>
          <h2 className="text-lg font-semibold text-stone-800 mb-2">您已是认证用户</h2>
          <p className="text-sm text-stone-500 mb-6">
            您当前的角色是：{user.role === 'counselor' ? '辅导员' : '心理老师'}
          </p>
          <button
            onClick={() => navigate('/settings')}
            className="px-6 py-2.5 bg-stone-800 text-white rounded-lg text-sm hover:bg-stone-700"
          >
            返回设置
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-stone-500 hover:text-stone-700">
          ← 返回
        </button>
        <h1 className="text-lg font-semibold text-stone-800">申请成为辅导员/心理老师</h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 角色选择 */}
          <div className="bg-white rounded-xl border border-stone-200 p-5">
            <h3 className="font-medium text-stone-800 mb-3">选择申请角色</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'counselor' as const, label: '辅导员', desc: '日常关怀与预警关注' },
                { value: 'psychologist' as const, label: '心理老师', desc: '专业心理咨询支持' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTargetRole(opt.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${
                    targetRole === opt.value
                      ? 'border-stone-800 bg-stone-50'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  <div className="font-medium text-stone-800">{opt.label}</div>
                  <div className="text-xs text-stone-400 mt-1">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 基本信息 */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <h3 className="font-medium text-stone-800">基本信息</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-stone-600 mb-1">真实姓名 *</label>
                <input
                  type="text"
                  value={realName}
                  onChange={(e) => setRealName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  placeholder="请输入真实姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">所属院系 *</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  placeholder="如：计算机科学学院"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">工号</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  placeholder="选填"
                />
              </div>
              <div>
                <label className="block text-sm text-stone-600 mb-1">联系电话</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  placeholder="选填"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-stone-600 mb-1">个人简介/申请说明</label>
              <textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                rows={3}
                placeholder="简要说明您的资质和申请原因（选填，最多500字）"
                maxLength={500}
              />
            </div>
          </div>

          {/* 绑定范围 */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-stone-800">管理范围</h3>
              <button
                type="button"
                onClick={addBinding}
                className="text-sm text-stone-600 hover:text-stone-800 underline"
              >
                + 添加范围
              </button>
            </div>
            <p className="text-xs text-stone-400">您申请管理的院系或班级，审核通过后只能查看范围内的学生数据</p>
            {bindings.map((b, i) => (
              <div key={i} className="flex gap-3 items-center">
                <select
                  value={b.scope_type}
                  onChange={(e) => updateBinding(i, 'scope_type', e.target.value)}
                  className="px-3 py-2 border border-stone-300 rounded-lg text-sm w-24"
                >
                  <option value="department">院系</option>
                  <option value="class">班级</option>
                </select>
                <input
                  type="text"
                  value={b.scope_name}
                  onChange={(e) => updateBinding(i, 'scope_name', e.target.value)}
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm"
                  placeholder="如：软件工程2班"
                />
                <button
                  type="button"
                  onClick={() => removeBinding(i)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  删除
                </button>
              </div>
            ))}
            {bindings.length === 0 && (
              <div className="text-center text-stone-400 text-sm py-4">
                点击"添加范围"指定您管理的院系或班级
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '提交中...' : '提交申请'}
          </button>
        </form>
      </main>
    </div>
  )
}

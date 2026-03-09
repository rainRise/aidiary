// 用户画像设置页面
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/components/ui/toast'

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
]

const SOCIAL_STYLES = [
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '随意' },
  { value: 'humorous', label: '幽默' },
  { value: 'professional', label: '专业' },
  { value: 'friendly', label: '友好' },
  { value: 'reserved', label: '内向' },
]

const CURRENT_STATES = [
  '工作', '学习', '创业', '自由职业',
  '退休', '间隔年', '其他',
]

export default function ProfileSettings() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [username, setUsername] = useState(user?.username || '')
  const [mbti, setMbti] = useState('')
  const [socialStyle, setSocialStyle] = useState('')
  const [currentState, setCurrentState] = useState('')
  const [catchphrases, setCatchphrases] = useState<string[]>([])
  const [newCatchphrase, setNewCatchphrase] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleAddCatchphrase = () => {
    if (newCatchphrase.trim() && !catchphrases.includes(newCatchphrase.trim())) {
      setCatchphrases([...catchphrases, newCatchphrase.trim()])
      setNewCatchphrase('')
    }
  }

  const handleRemoveCatchphrase = (index: number) => {
    setCatchphrases(catchphrases.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setIsSaving(true)

    // TODO: 调用API更新用户画像
    const profileData = {
      username: username.trim(),
      identity_tag: mbti || '通用',
      current_state: currentState || '正常',
      personality_type: mbti || 'INFP',
      social_style: socialStyle || '真实',
      catchphrases,
    }

    console.log('Saving profile:', profileData)

    // 模拟API调用
    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSaving(false)
    toast('画像设置已保存', 'success')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              ← 返回
            </Button>
            <h1 className="text-xl font-bold">用户画像设置</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      {/* 主内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-6">
          {/* 基本信息 */}
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>告诉我们如何称呼你</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  用户名
                </label>
                <Input
                  id="username"
                  type="text"
                  placeholder="如何称呼你"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  邮箱（不可修改）
                </label>
                <Input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
            </CardContent>
          </Card>

          {/* 性格类型 */}
          <Card>
            <CardHeader>
              <CardTitle>MBTI性格类型</CardTitle>
              <CardDescription>选择你的性格类型（可选）</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {MBTI_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setMbti(type)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      mbti === type
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 社交风格 */}
          <Card>
            <CardHeader>
              <CardTitle>社交风格</CardTitle>
              <CardDescription>你通常如何表达自己？</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2">
                {SOCIAL_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setSocialStyle(style.value)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      socialStyle === style.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 当前状态 */}
          <Card>
            <CardHeader>
              <CardTitle>当前状态</CardTitle>
              <CardDescription>你目前的职业或状态</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {CURRENT_STATES.map((state) => (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setCurrentState(state)}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      currentState === state
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {state}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 口头禅 */}
          <Card>
            <CardHeader>
              <CardTitle>口头禅</CardTitle>
              <CardDescription>
                添加你常用的表达，AI会学习你的风格
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="例如：哈哈、好的、收到..."
                  value={newCatchphrase}
                  onChange={(e) => setNewCatchphrase(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddCatchphrase()
                    }
                  }}
                />
                <Button type="button" onClick={handleAddCatchphrase}>
                  添加
                </Button>
              </div>

              {catchphrases.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {catchphrases.map((phrase, index) => (
                    <span
                      key={index}
                      className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full flex items-center gap-2"
                    >
                      {phrase}
                      <button
                        type="button"
                        onClick={() => handleRemoveCatchphrase(index)}
                        className="hover:text-red-500"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 保存按钮 */}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/')}
            >
              取消
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}

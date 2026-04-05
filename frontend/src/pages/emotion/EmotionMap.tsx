// 情绪星图 — 基于特征向量聚类的情绪可视化
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { emotionService, type EmotionClusterResult, type EmotionPoint } from '@/services/emotion.service'
import { toast } from '@/components/ui/toast'
import { Loader2, ArrowLeft, Info, Sparkles, BarChart3 } from 'lucide-react'

// 聚类调色板 — 温暖风
const CLUSTER_COLORS = [
  '#e8927c', // 珊瑚橙
  '#7cade8', // 天蓝
  '#a8d5a2', // 草绿
  '#d4a0d4', // 薰衣草
  '#e8d27c', // 暖金
  '#7ce8d5', // 薄荷
]

const CLUSTER_COLORS_LIGHT = [
  'rgba(232,146,124,0.15)',
  'rgba(124,173,232,0.15)',
  'rgba(168,213,162,0.15)',
  'rgba(212,160,212,0.15)',
  'rgba(232,210,124,0.15)',
  'rgba(124,232,213,0.15)',
]

// 特征中文标签
const FEATURE_LABELS: Record<string, string> = {
  valence: '情绪效价', arousal: '唤醒度', dominance: '控制感',
  self_ref: '自我参照', social: '社交密度', cognitive: '认知复杂度',
  temporal: '时间取向', richness: '表达丰富度',
}

export default function EmotionMap() {
  const navigate = useNavigate()
  const [data, setData] = useState<EmotionClusterResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoveredPoint, setHoveredPoint] = useState<EmotionPoint | null>(null)
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null)
  const [showInfo, setShowInfo] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const result = await emotionService.getClusterAnalysis(200)
        setData(result)
      } catch {
        toast('加载情绪分析失败', 'error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // 过滤显示的点
  const visiblePoints = useMemo(() => {
    if (!data) return []
    if (selectedCluster === null) return data.points
    return data.points.filter(p => p.cluster === selectedCluster)
  }, [data, selectedCluster])

  // 计算坐标范围用于缩放
  const bounds = useMemo(() => {
    if (!data || data.points.length === 0) return { minX: -3, maxX: 3, minY: -3, maxY: 3 }
    const xs = data.points.map(p => p.x)
    const ys = data.points.map(p => p.y)
    const pad = 0.5
    return {
      minX: Math.min(...xs) - pad, maxX: Math.max(...xs) + pad,
      minY: Math.min(...ys) - pad, maxY: Math.max(...ys) + pad,
    }
  }, [data])

  // 坐标映射到 SVG
  const SVG_W = 600, SVG_H = 400, PAD = 40
  const toSvgX = useCallback((x: number) => {
    return PAD + ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (SVG_W - PAD * 2)
  }, [bounds])
  const toSvgY = useCallback((y: number) => {
    return SVG_H - PAD - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (SVG_H - PAD * 2)
  }, [bounds])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#c17f6e]" />
      </div>
    )
  }

  if (!data || data.points.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-stone-400">
        <Sparkles className="w-12 h-12" />
        <p className="text-lg">还没有足够的日记来分析情绪模式</p>
        <p className="text-sm">写几篇日记后再来看看吧</p>
        <button onClick={() => navigate('/diaries')} className="mt-2 px-4 py-2 rounded-xl bg-[#c17f6e] text-white text-sm">
          去写日记
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#faf6f2] to-[#f3ede8] pb-20">
      {/* 顶栏 */}
      <div className="sticky top-0 z-20 bg-[#faf6f2]/80 backdrop-blur-md border-b border-[#e7dbd5]/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl hover:bg-[#f0e6df] transition">
            <ArrowLeft className="w-5 h-5 text-stone-500" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-stone-700">情绪星图</h1>
            <p className="text-xs text-stone-400">基于 {data.stats.total_diaries} 篇日记的特征向量聚类分析</p>
          </div>
          <button onClick={() => setShowInfo(!showInfo)} className="p-1.5 rounded-xl hover:bg-[#f0e6df] transition">
            <Info className="w-5 h-5 text-stone-400" />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* 算法说明面板 */}
        {showInfo && (
          <div className="p-4 rounded-2xl bg-white/60 border border-[#e7dbd5]/50 text-xs text-stone-500 space-y-2 animate-fade-in">
            <p className="font-semibold text-stone-600">算法原理</p>
            <p>每篇日记通过 <b>中文情绪词典 (VAD模型)</b> + <b>NLP特征工程</b> 提取为 <b>8维特征向量</b>：</p>
            <p className="font-mono text-[10px] bg-stone-50 p-2 rounded-lg">
              [效价, 唤醒度, 控制感, 自我参照, 社交密度, 认知复杂度, 时间取向, 表达丰富度]
            </p>
            <p>经 <b>Z-Score标准化</b> → <b>K-Means聚类</b>（肘部法则+轮廓系数自动选K）→ <b>PCA降维</b> 到2D可视化。</p>
            <p>轮廓系数: <b>{data.stats.silhouette_score}</b> (越接近1聚类越好)</p>
            {data.stats.explained_variance_2d.length > 0 && (
              <p>PCA累计方差解释率: <b>{(data.stats.explained_variance_2d.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%</b></p>
            )}
            <div className="flex gap-4 text-[10px]">
              <span>PC1: {data.pca_components.pc1_label}</span>
              <span>PC2: {data.pca_components.pc2_label}</span>
            </div>
          </div>
        )}

        {/* 聚类标签卡片 */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCluster(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border ${
              selectedCluster === null
                ? 'bg-stone-700 text-white border-stone-700'
                : 'bg-white/60 text-stone-500 border-[#e7dbd5] hover:bg-[#f0e6df]'
            }`}
          >
            全部 ({data.points.length})
          </button>
          {data.clusters.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCluster(selectedCluster === c.id ? null : c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition border flex items-center gap-1.5 ${
                selectedCluster === c.id
                  ? 'text-white border-transparent'
                  : 'bg-white/60 text-stone-600 border-[#e7dbd5] hover:bg-[#f0e6df]'
              }`}
              style={selectedCluster === c.id ? { background: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length] } : {}}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length] }} />
              {c.label} ({c.size})
            </button>
          ))}
        </div>

        {/* 散点图主体 */}
        <div className="relative rounded-2xl bg-white/70 border border-[#e7dbd5]/50 shadow-sm overflow-hidden">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full"
            style={{ maxHeight: '480px' }}
          >
            {/* 背景网格 */}
            {Array.from({ length: 7 }, (_, i) => {
              const x = PAD + ((SVG_W - PAD * 2) / 6) * i
              return <line key={`vg${i}`} x1={x} y1={PAD} x2={x} y2={SVG_H - PAD} stroke="#f0e6df" strokeWidth={0.5} />
            })}
            {Array.from({ length: 5 }, (_, i) => {
              const y = PAD + ((SVG_H - PAD * 2) / 4) * i
              return <line key={`hg${i}`} x1={PAD} y1={y} x2={SVG_W - PAD} y2={y} stroke="#f0e6df" strokeWidth={0.5} />
            })}

            {/* 坐标轴标签 */}
            <text x={SVG_W / 2} y={SVG_H - 8} textAnchor="middle" fontSize={10} fill="#a89990">
              {data.pca_components.pc1_label}
            </text>
            <text x={12} y={SVG_H / 2} textAnchor="middle" fontSize={10} fill="#a89990" transform={`rotate(-90, 12, ${SVG_H / 2})`}>
              {data.pca_components.pc2_label}
            </text>

            {/* 聚类区域背景（凸包简化为圆） */}
            {data.clusters.map(c => {
              const clusterPoints = data.points.filter(p => p.cluster === c.id)
              if (clusterPoints.length < 2) return null
              const cx = clusterPoints.reduce((s, p) => s + toSvgX(p.x), 0) / clusterPoints.length
              const cy = clusterPoints.reduce((s, p) => s + toSvgY(p.y), 0) / clusterPoints.length
              const maxR = Math.max(
                ...clusterPoints.map(p => Math.hypot(toSvgX(p.x) - cx, toSvgY(p.y) - cy)),
                20
              )
              return (
                <circle
                  key={`bg${c.id}`}
                  cx={cx} cy={cy} r={maxR + 15}
                  fill={CLUSTER_COLORS_LIGHT[c.id % CLUSTER_COLORS_LIGHT.length]}
                  stroke={CLUSTER_COLORS[c.id % CLUSTER_COLORS.length]}
                  strokeWidth={0.5}
                  strokeDasharray="4 2"
                  opacity={selectedCluster === null || selectedCluster === c.id ? 0.6 : 0.1}
                />
              )
            })}

            {/* 数据点 */}
            {visiblePoints.map(p => {
              const cx = toSvgX(p.x)
              const cy = toSvgY(p.y)
              const color = CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length]
              const isHovered = hoveredPoint?.diary_id === p.diary_id
              return (
                <g key={p.diary_id}>
                  <circle
                    cx={cx} cy={cy}
                    r={isHovered ? 8 : 5}
                    fill={color}
                    fillOpacity={isHovered ? 1 : 0.75}
                    stroke={isHovered ? '#4a3f3a' : color}
                    strokeWidth={isHovered ? 2 : 1}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setHoveredPoint(p)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    onClick={() => navigate(`/diaries/${p.diary_id}`)}
                  />
                  {isHovered && (
                    <text x={cx} y={cy - 14} textAnchor="middle" fontSize={10} fill="#4a3f3a" fontWeight={600}>
                      {p.title.length > 12 ? p.title.slice(0, 12) + '...' : p.title}
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Hover 详情卡 */}
          {hoveredPoint && (
            <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-white/95 backdrop-blur-sm border border-[#e7dbd5] shadow-lg text-xs animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-stone-700">{hoveredPoint.title}</span>
                <span className="text-stone-400">{hoveredPoint.diary_date}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(hoveredPoint.features).map(([key, val]) => (
                  <div key={key} className="text-center">
                    <div className="text-[10px] text-stone-400">{FEATURE_LABELS[key] || key}</div>
                    <div className="font-mono text-stone-600">{val.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 聚类详情卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.clusters.map(c => (
            <div
              key={c.id}
              className={`p-4 rounded-2xl border transition cursor-pointer ${
                selectedCluster === c.id
                  ? 'bg-white border-stone-300 shadow-md'
                  : 'bg-white/50 border-[#e7dbd5]/50 hover:bg-white/80'
              }`}
              onClick={() => setSelectedCluster(selectedCluster === c.id ? null : c.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full" style={{ background: CLUSTER_COLORS[c.id % CLUSTER_COLORS.length] }} />
                <span className="font-semibold text-stone-700">{c.label}</span>
                <span className="text-xs text-stone-400 ml-auto">{c.size} 篇</span>
              </div>
              {c.dominant_features.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {c.dominant_features.map(f => (
                    <span key={f.name} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-50 text-stone-500">
                      {f.label}: {f.value > 0 ? '+' : ''}{f.value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 整体统计 */}
        <div className="p-4 rounded-2xl bg-white/50 border border-[#e7dbd5]/50">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-stone-400" />
            <span className="text-sm font-semibold text-stone-600">情绪概况</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="平均效价" value={data.stats.avg_valence} desc={data.stats.avg_valence > 0.2 ? '偏积极' : data.stats.avg_valence < -0.2 ? '偏消极' : '中性'} />
            <StatCard label="平均唤醒度" value={data.stats.avg_arousal} desc={data.stats.avg_arousal > 0.5 ? '偏激动' : '偏平静'} />
            <StatCard label="平均控制感" value={data.stats.avg_dominance} desc={data.stats.avg_dominance > 0.5 ? '有掌控力' : '偏被动'} />
            <StatCard label="情绪波动" value={data.stats.valence_std} desc={data.stats.valence_std > 0.4 ? '波动较大' : '相对稳定'} />
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, desc }: { label: string; value: number; desc: string }) {
  return (
    <div className="text-center p-2 rounded-xl bg-[#faf6f2]/60">
      <div className="text-[10px] text-stone-400 mb-0.5">{label}</div>
      <div className="text-lg font-bold text-stone-700">{value > 0 ? '+' : ''}{value.toFixed(2)}</div>
      <div className="text-[10px] text-stone-400">{desc}</div>
    </div>
  )
}

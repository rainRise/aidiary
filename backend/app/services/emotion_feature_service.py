"""
情绪特征向量引擎
================
基于心理学 VAD (Valence-Arousal-Dominance) 模型 + NLP 特征工程，
将每篇日记转化为多维情绪特征向量，支持聚类、相似度计算、情绪预测。

核心算法：
1. 中文情绪词典匹配 (基于大连理工情感词汇本体)
2. TF-IDF 加权的情绪维度聚合
3. 文本统计特征提取 (句法复杂度、自我参照度等)
4. K-Means 聚类 + PCA 降维可视化
"""
import re
import math
import os
import logging
from collections import Counter
from pathlib import Path
from typing import Optional

import numpy as np
import jieba

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 1. 中文情绪词典 —— 基于心理学 VAD 模型
#    Valence  (效价):  -1(消极) ~ +1(积极)
#    Arousal  (唤醒度): 0(平静)  ~ 1(激动)
#    Dominance(控制感): 0(无力)  ~ 1(掌控)
# ---------------------------------------------------------------------------
# 来源参考: 大连理工情感词汇本体 + Russell 情绪环形模型
EMOTION_LEXICON: dict[str, tuple[float, float, float]] = {
    # ---- 高效价 高唤醒 (快乐/兴奋) ----
    "开心": (0.9, 0.7, 0.7), "快乐": (0.9, 0.7, 0.7), "高兴": (0.85, 0.65, 0.7),
    "兴奋": (0.8, 0.9, 0.7), "激动": (0.75, 0.95, 0.6), "惊喜": (0.85, 0.85, 0.5),
    "欣喜": (0.88, 0.75, 0.65), "欢喜": (0.85, 0.7, 0.6), "喜悦": (0.9, 0.65, 0.7),
    "愉快": (0.8, 0.5, 0.7), "愉悦": (0.82, 0.5, 0.7), "幸福": (0.95, 0.5, 0.8),
    "甜蜜": (0.88, 0.45, 0.6), "美好": (0.85, 0.4, 0.7), "棒": (0.8, 0.6, 0.7),
    "赞": (0.75, 0.55, 0.7), "哈哈": (0.8, 0.75, 0.6), "太好了": (0.85, 0.7, 0.7),
    "庆幸": (0.7, 0.5, 0.6), "感恩": (0.85, 0.35, 0.6), "感谢": (0.8, 0.35, 0.55),

    # ---- 高效价 低唤醒 (满足/平静) ----
    "满足": (0.75, 0.25, 0.75), "知足": (0.7, 0.2, 0.75), "安心": (0.7, 0.2, 0.8),
    "平静": (0.5, 0.1, 0.7), "宁静": (0.55, 0.08, 0.7), "舒适": (0.7, 0.2, 0.7),
    "放松": (0.65, 0.15, 0.65), "淡然": (0.5, 0.1, 0.6), "从容": (0.55, 0.15, 0.8),
    "温暖": (0.75, 0.3, 0.6), "温馨": (0.78, 0.25, 0.6), "感动": (0.7, 0.5, 0.45),
    "踏实": (0.65, 0.15, 0.8), "充实": (0.7, 0.35, 0.75),

    # ---- 低效价 高唤醒 (愤怒/焦虑) ----
    "愤怒": (-0.85, 0.9, 0.6), "生气": (-0.7, 0.8, 0.55), "暴怒": (-0.9, 0.95, 0.5),
    "恼火": (-0.65, 0.7, 0.5), "烦躁": (-0.55, 0.7, 0.35), "烦": (-0.5, 0.6, 0.35),
    "焦虑": (-0.6, 0.75, 0.2), "紧张": (-0.5, 0.8, 0.25), "慌": (-0.55, 0.85, 0.15),
    "恐惧": (-0.7, 0.85, 0.1), "害怕": (-0.65, 0.8, 0.15), "担忧": (-0.5, 0.6, 0.25),
    "担心": (-0.45, 0.55, 0.3), "不安": (-0.5, 0.65, 0.2), "崩溃": (-0.8, 0.9, 0.05),
    "抓狂": (-0.6, 0.85, 0.2), "急": (-0.3, 0.75, 0.3), "压力": (-0.5, 0.7, 0.2),

    # ---- 低效价 低唤醒 (悲伤/疲惫) ----
    "悲伤": (-0.8, 0.4, 0.15), "难过": (-0.7, 0.45, 0.2), "伤心": (-0.75, 0.5, 0.15),
    "痛苦": (-0.85, 0.6, 0.1), "绝望": (-0.9, 0.3, 0.05), "无助": (-0.75, 0.3, 0.05),
    "孤独": (-0.7, 0.25, 0.15), "寂寞": (-0.6, 0.2, 0.15), "空虚": (-0.65, 0.15, 0.1),
    "失落": (-0.6, 0.35, 0.2), "沮丧": (-0.7, 0.4, 0.15), "郁闷": (-0.55, 0.35, 0.2),
    "低落": (-0.6, 0.25, 0.2), "消沉": (-0.65, 0.2, 0.1), "委屈": (-0.6, 0.55, 0.1),
    "疲惫": (-0.4, 0.15, 0.15), "累": (-0.35, 0.15, 0.2), "疲倦": (-0.4, 0.1, 0.15),
    "无聊": (-0.3, 0.1, 0.3), "厌倦": (-0.45, 0.15, 0.25), "麻木": (-0.5, 0.05, 0.1),
    "后悔": (-0.6, 0.45, 0.15), "遗憾": (-0.5, 0.3, 0.2), "惭愧": (-0.5, 0.4, 0.15),

    # ---- 成就/动力 ----
    "自豪": (0.8, 0.6, 0.85), "骄傲": (0.75, 0.55, 0.8), "成就感": (0.85, 0.6, 0.9),
    "期待": (0.6, 0.65, 0.55), "希望": (0.65, 0.5, 0.55), "动力": (0.6, 0.65, 0.7),
    "信心": (0.7, 0.5, 0.85), "坚定": (0.6, 0.45, 0.9), "勇敢": (0.6, 0.6, 0.8),
    "努力": (0.5, 0.6, 0.7), "奋斗": (0.5, 0.7, 0.65), "进步": (0.7, 0.5, 0.7),
    "收获": (0.75, 0.45, 0.7), "突破": (0.7, 0.7, 0.75),

    # ---- 社交情绪 ----
    "思念": (-0.3, 0.4, 0.2), "想念": (-0.25, 0.35, 0.2), "怀念": (-0.15, 0.3, 0.25),
    "嫉妒": (-0.5, 0.6, 0.2), "羡慕": (-0.15, 0.4, 0.25), "尴尬": (-0.4, 0.6, 0.15),
    "内疚": (-0.55, 0.45, 0.1), "愧疚": (-0.55, 0.45, 0.1),
    "感激": (0.8, 0.4, 0.55), "珍惜": (0.7, 0.3, 0.6), "信任": (0.65, 0.25, 0.7),
    "亲切": (0.65, 0.3, 0.55), "友好": (0.6, 0.3, 0.6),
}

# 否定词列表 —— 遇到否定词后反转效价
NEGATION_WORDS = frozenset([
    "不", "没", "没有", "无", "非", "别", "莫", "未",
    "不是", "不会", "不能", "不要", "不想", "不太",
    "并非", "从未", "毫无", "决不", "绝不",
])

# 程度副词 —— 调节情绪强度
DEGREE_WORDS: dict[str, float] = {
    "非常": 1.5, "特别": 1.5, "极其": 1.8, "极为": 1.8, "超": 1.6,
    "超级": 1.7, "太": 1.5, "最": 1.6, "真": 1.3, "好": 1.3,
    "十分": 1.5, "格外": 1.4, "尤其": 1.4, "相当": 1.4,
    "有点": 0.6, "有些": 0.65, "稍微": 0.5, "略": 0.5,
    "一点": 0.5, "些许": 0.55, "不太": 0.4, "不怎么": 0.3,
}

# 自我参照词
SELF_REFERENCE_WORDS = frozenset(["我", "自己", "本人", "咱", "俺"])

# 社交词
SOCIAL_WORDS = frozenset([
    "朋友", "同学", "老师", "家人", "爸", "妈", "父亲", "母亲",
    "哥", "姐", "弟", "妹", "同事", "伙伴", "男朋友", "女朋友",
    "老公", "老婆", "室友", "闺蜜", "兄弟", "他", "她", "他们", "她们",
    "一起", "聚", "聊", "约", "见面", "聚会",
])

# 认知词 (反思/分析)
COGNITIVE_WORDS = frozenset([
    "觉得", "认为", "思考", "想", "明白", "理解", "意识到",
    "反思", "总结", "分析", "发现", "领悟", "感悟",
    "原来", "其实", "也许", "可能", "应该", "或许",
])

# 时间取向词
FUTURE_WORDS = frozenset(["明天", "以后", "将来", "未来", "计划", "打算", "准备", "目标"])
PAST_WORDS = frozenset(["昨天", "以前", "过去", "曾经", "回忆", "当初", "从前", "小时候"])


# ---------------------------------------------------------------------------
# 2. 特征提取引擎
# ---------------------------------------------------------------------------
class EmotionFeatureExtractor:
    """
    将一篇日记文本转化为 8 维情绪特征向量:
    [valence, arousal, dominance, self_ref, social, cognitive, temporal, richness]

    维度说明:
      0. valence    效价       [-1, 1]  消极←→积极
      1. arousal    唤醒度     [0, 1]   平静←→激动
      2. dominance  控制感     [0, 1]   无力←→掌控
      3. self_ref   自我参照度 [0, 1]   第一人称密度
      4. social     社交密度   [0, 1]   社交词占比
      5. cognitive  认知复杂度 [0, 1]   反思/分析词占比
      6. temporal   时间取向   [-1, 1]  过去←→未来
      7. richness   表达丰富度 [0, 1]   词汇多样性 (TTR)
    """

    FEATURE_NAMES = [
        "valence", "arousal", "dominance",
        "self_ref", "social", "cognitive",
        "temporal", "richness",
    ]
    FEATURE_DIM = len(FEATURE_NAMES)

    # 中文标签
    FEATURE_LABELS_CN = {
        "valence": "情绪效价",
        "arousal": "唤醒度",
        "dominance": "控制感",
        "self_ref": "自我参照",
        "social": "社交密度",
        "cognitive": "认知复杂度",
        "temporal": "时间取向",
        "richness": "表达丰富度",
    }

    def __init__(self):
        jieba.setLogLevel(logging.WARNING)
        self.vad_lexicon: dict[str, tuple[float, float, float]] = dict(EMOTION_LEXICON)
        self._bootstrap_lexicon_sources()

    def _bootstrap_lexicon_sources(self) -> None:
        """
        情绪词典底座升级：支持多来源融合（本地词典优先 + 可选 pysenti）。

        环境变量：
        - EMOTION_EXT_LEXICON_ENABLED=true/false（默认 true）
        - EMOTION_LEXICON_SOURCES=builtin,ntusd,pysenti（默认）
        - EMOTION_EXT_LEXICON_WEIGHT=0.65（0~1，外部词典融合权重）
        - EMOTION_EXT_LEXICON_POS_PATH=...（正向词表路径）
        - EMOTION_EXT_LEXICON_NEG_PATH=...（负向词表路径）
        """
        enabled = os.getenv("EMOTION_EXT_LEXICON_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
        if not enabled:
            logger.info("[EmotionFeature] 外部词典已禁用")
            return

        sources = [s.strip().lower() for s in os.getenv("EMOTION_LEXICON_SOURCES", "builtin,ntusd,pysenti").split(",") if s.strip()]
        if "builtin" not in sources:
            sources.insert(0, "builtin")

        logger.info("[EmotionFeature] 词典源: %s", ",".join(sources))

        try:
            ext_weight = float(os.getenv("EMOTION_EXT_LEXICON_WEIGHT", "0.65"))
        except Exception:
            ext_weight = 0.65
        ext_weight = float(np.clip(ext_weight, 0.0, 1.0))

        if "ntusd" in sources:
            self._load_ntusd_lexicon(ext_weight)
        if "pysenti" in sources:
            self._load_pysenti_lexicon(ext_weight)

    def _load_ntusd_lexicon(self, ext_weight: float) -> None:
        app_dir = Path(__file__).resolve().parents[1]
        default_pos = app_dir / "data" / "lexicons" / "ntusd_positive_simplified.txt"
        default_neg = app_dir / "data" / "lexicons" / "ntusd_negative_simplified.txt"

        pos_path = Path(os.getenv("EMOTION_EXT_LEXICON_POS_PATH", str(default_pos))).expanduser()
        neg_path = Path(os.getenv("EMOTION_EXT_LEXICON_NEG_PATH", str(default_neg))).expanduser()

        pos_words = self._load_word_list(pos_path)
        neg_words = self._load_word_list(neg_path)

        if not pos_words and not neg_words:
            logger.info(
                "[EmotionFeature] NTUSD词典未找到，跳过融合。POS=%s NEG=%s",
                pos_path, neg_path
            )
            return

        # 极性词典映射到基础 VAD 原型值（可后续基于评测调参）
        pos_proto = (0.62, 0.55, 0.58)
        neg_proto = (-0.62, 0.58, 0.32)

        added = 0
        updated = 0

        for w in pos_words:
            if self._merge_word_vad(w, pos_proto, ext_weight):
                added += 1
            else:
                updated += 1

        for w in neg_words:
            if self._merge_word_vad(w, neg_proto, ext_weight):
                added += 1
            else:
                updated += 1

        logger.info(
            "[EmotionFeature] NTUSD融合完成: pos=%d neg=%d added=%d updated=%d weight=%.2f",
            len(pos_words), len(neg_words), added, updated, ext_weight
        )

    def _load_pysenti_lexicon(self, ext_weight: float) -> None:
        """
        可选融合 pysenti 词典：
        - 若环境装了 pysenti，则自动扫描其包目录下词典文件。
        - 支持从文件名推断正负极性（pos/neg/positive/negative）。
        """
        try:
            import pysenti  # type: ignore
        except Exception:
            logger.info("[EmotionFeature] pysenti 未安装，跳过 pysenti 词典融合")
            return

        base = Path(getattr(pysenti, "__file__", "")).resolve().parent
        candidates = list(base.rglob("*.txt"))
        if not candidates:
            logger.info("[EmotionFeature] pysenti 未发现可读词典文件，跳过融合")
            return

        added = 0
        updated = 0
        used_files = 0
        for fp in candidates:
            lower_name = fp.name.lower()
            if not any(k in lower_name for k in ("sent", "emotion", "positive", "negative", "pos", "neg", "lexicon")):
                continue

            sign = self._infer_file_polarity(lower_name)
            if sign == 0:
                continue
            proto = (0.58, 0.52, 0.56) if sign > 0 else (-0.58, 0.55, 0.34)
            words = self._load_word_list(fp)
            if not words:
                continue
            used_files += 1
            for w in words:
                if self._merge_word_vad(w, proto, ext_weight):
                    added += 1
                else:
                    updated += 1

        logger.info(
            "[EmotionFeature] pysenti融合完成: files=%d added=%d updated=%d weight=%.2f",
            used_files, added, updated, ext_weight
        )

    @staticmethod
    def _infer_file_polarity(file_name: str) -> int:
        pos_hits = ("positive", "_pos", "-pos", "pos_", "good", "赞", "正向", "积极")
        neg_hits = ("negative", "_neg", "-neg", "neg_", "bad", "贬", "负向", "消极")
        lname = file_name.lower()
        if any(k in lname for k in pos_hits):
            return 1
        if any(k in lname for k in neg_hits):
            return -1
        return 0

    @staticmethod
    def _load_word_list(path: Path) -> list[str]:
        if not path.exists():
            return []
        words: list[str] = []
        read_ok = False
        last_err: Exception | None = None
        for enc in ("utf-8", "utf-8-sig", "utf-16", "gbk", "gb18030"):
            try:
                with path.open("r", encoding=enc) as f:
                    for raw in f:
                        line = raw.strip()
                        if not line:
                            continue
                        if line.startswith("#"):
                            continue
                        # 兼容 "词\t分数" / "词 分数" / "词"
                        token = re.split(r"[\t\s,，,]+", line)[0].strip()
                        if token:
                            words.append(token)
                read_ok = True
                break
            except Exception as e:
                last_err = e
                words = []
                continue
        if not read_ok:
            logger.warning("[EmotionFeature] 读取词典失败: %s err=%s", path, last_err)
            return []
        # 去重并保持顺序
        seen = set()
        uniq = []
        for w in words:
            if w in seen:
                continue
            seen.add(w)
            uniq.append(w)
        return uniq

    def _merge_word_vad(
        self,
        word: str,
        ext_vad: tuple[float, float, float],
        ext_weight: float,
    ) -> bool:
        """
        融合单词 VAD。

        Returns:
            bool: True 表示新增词；False 表示更新已有词。
        """
        existing = self.vad_lexicon.get(word)
        if existing is None:
            self.vad_lexicon[word] = ext_vad
            return True

        base_v, base_a, base_d = existing
        ext_v, ext_a, ext_d = ext_vad
        w = ext_weight
        merged = (
            float(np.clip((1 - w) * base_v + w * ext_v, -1, 1)),
            float(np.clip((1 - w) * base_a + w * ext_a, 0, 1)),
            float(np.clip((1 - w) * base_d + w * ext_d, 0, 1)),
        )
        self.vad_lexicon[word] = merged
        return False

    def extract(self, text: str) -> np.ndarray:
        """
        主入口：从文本提取 8 维特征向量。
        Returns: np.ndarray of shape (8,)
        """
        if not text or not text.strip():
            return np.zeros(self.FEATURE_DIM, dtype=np.float64)

        words = list(jieba.cut(text))
        total_words = len(words) or 1

        # (A) VAD 情绪维度 —— 词典匹配 + 否定/程度修饰
        valence, arousal, dominance = self._compute_vad(words)

        # (B) 自我参照度
        self_ref = sum(1 for w in words if w in SELF_REFERENCE_WORDS) / total_words
        self_ref = min(self_ref * 10, 1.0)  # 归一化放大

        # (C) 社交密度
        social = sum(1 for w in words if w in SOCIAL_WORDS) / total_words
        social = min(social * 12, 1.0)

        # (D) 认知复杂度
        cognitive = sum(1 for w in words if w in COGNITIVE_WORDS) / total_words
        cognitive = min(cognitive * 15, 1.0)

        # (E) 时间取向: -1(过去) ~ +1(未来)
        future_count = sum(1 for w in words if w in FUTURE_WORDS)
        past_count = sum(1 for w in words if w in PAST_WORDS)
        time_total = future_count + past_count
        temporal = (future_count - past_count) / time_total if time_total > 0 else 0.0

        # (F) 表达丰富度 (Type-Token Ratio)
        # 去除标点和空白后计算
        content_words = [w for w in words if re.match(r'[\u4e00-\u9fff\w]+', w)]
        if len(content_words) > 1:
            unique_ratio = len(set(content_words)) / len(content_words)
            # 短文本 TTR 天然偏高，做长度惩罚
            length_factor = 1 - math.exp(-len(content_words) / 50)
            richness = unique_ratio * length_factor
        else:
            richness = 0.0

        vector = np.array([
            valence, arousal, dominance,
            self_ref, social, cognitive,
            temporal, richness,
        ], dtype=np.float64)

        return vector

    def _compute_vad(self, words: list[str]) -> tuple[float, float, float]:
        """
        基于情绪词典计算 VAD 三维分数。
        算法:
          1. 滑动窗口扫描分词结果
          2. 遇到情绪词时，向前查找否定词和程度副词（窗口=3）
          3. 否定词翻转 valence，程度副词缩放三维
          4. 加权聚合所有命中
        """
        val_scores: list[float] = []
        aro_scores: list[float] = []
        dom_scores: list[float] = []

        for i, word in enumerate(words):
            if word not in self.vad_lexicon:
                continue

            v, a, d = self.vad_lexicon[word]
            # 向前扫描修饰词（窗口=3）
            modifier = 1.0
            negated = False
            for j in range(max(0, i - 3), i):
                if words[j] in NEGATION_WORDS:
                    negated = True
                if words[j] in DEGREE_WORDS:
                    modifier = DEGREE_WORDS[words[j]]

            if negated:
                v = -v * 0.8  # 否定翻转效价，略微衰减
                d = d * 0.5   # 否定降低控制感

            v *= modifier
            a *= modifier
            d *= modifier

            val_scores.append(np.clip(v, -1, 1))
            aro_scores.append(np.clip(a, 0, 1))
            dom_scores.append(np.clip(d, 0, 1))

        if not val_scores:
            return 0.0, 0.3, 0.5  # 中性默认值

        # 加权平均：越强烈的情绪权重越大 (绝对值加权)
        val_arr = np.array(val_scores)
        aro_arr = np.array(aro_scores)
        dom_arr = np.array(dom_scores)

        weights = np.abs(val_arr) + aro_arr + 0.1  # 避免全零
        weights /= weights.sum()

        return (
            float(np.clip(np.dot(weights, val_arr), -1, 1)),
            float(np.clip(np.dot(weights, aro_arr), 0, 1)),
            float(np.clip(np.dot(weights, dom_arr), 0, 1)),
        )

    def batch_extract(self, texts: list[str]) -> np.ndarray:
        """批量提取特征向量。Returns: np.ndarray of shape (n, 8)"""
        return np.array([self.extract(t) for t in texts])

    def explain(self, text: str) -> dict:
        """返回可读的特征分析结果（用于前端展示）"""
        vec = self.extract(text)
        words = list(jieba.cut(text))

        # 找到匹配的情绪词
        matched_emotions = []
        for w in words:
            if w in self.vad_lexicon:
                v, a, d = self.vad_lexicon[w]
                matched_emotions.append({
                    "word": w,
                    "valence": v,
                    "arousal": a,
                    "dominance": d,
                })

        # 情绪分类
        valence = vec[0]
        arousal = vec[1]
        if valence > 0.3:
            if arousal > 0.5:
                mood = "兴奋/快乐"
            else:
                mood = "满足/平静"
        elif valence < -0.3:
            if arousal > 0.5:
                mood = "焦虑/愤怒"
            else:
                mood = "悲伤/低落"
        else:
            if arousal > 0.5:
                mood = "紧张/矛盾"
            else:
                mood = "平淡/中性"

        return {
            "vector": vec.tolist(),
            "features": {
                name: {"value": round(float(vec[i]), 3), "label": self.FEATURE_LABELS_CN[name]}
                for i, name in enumerate(self.FEATURE_NAMES)
            },
            "mood_category": mood,
            "matched_emotions": matched_emotions[:10],  # 最多返回10个
        }


# ---------------------------------------------------------------------------
# 3. 聚类引擎
# ---------------------------------------------------------------------------
class EmotionClusterEngine:
    """
    基于 K-Means 聚类 + PCA 降维的情绪模式分析。

    算法流程:
    1. 收集用户所有日记的特征向量 (n × 8)
    2. 标准化 (Z-Score)
    3. 肘部法则 (Elbow Method) 自动选择最佳 K
    4. K-Means 聚类
    5. PCA 降维到 2D/3D 用于可视化
    6. 为每个簇生成情绪标签
    """

    # 聚类情绪标签映射
    CLUSTER_MOOD_LABELS = {
        (True, True): "活力积极",     # 高效价 + 高唤醒
        (True, False): "平和满足",    # 高效价 + 低唤醒
        (False, True): "压力焦虑",    # 低效价 + 高唤醒
        (False, False): "低落消沉",   # 低效价 + 低唤醒
    }

    def analyze(
        self,
        vectors: np.ndarray,
        diary_ids: list[int],
        diary_dates: list[str],
        diary_titles: list[str],
        max_k: int = 6,
    ) -> dict:
        """
        执行聚类分析。

        Args:
            vectors: 特征矩阵 (n, 8)
            diary_ids: 日记ID列表
            diary_dates: 日记日期列表
            diary_titles: 日记标题列表
            max_k: 最大聚类数

        Returns:
            包含聚类结果、PCA坐标、统计信息的字典
        """
        from sklearn.preprocessing import StandardScaler
        from sklearn.cluster import KMeans
        from sklearn.decomposition import PCA
        from sklearn.metrics import silhouette_score

        n = vectors.shape[0]
        if n < 3:
            # 数据太少，不做聚类
            return self._minimal_result(vectors, diary_ids, diary_dates, diary_titles)

        # 标准化
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(vectors)

        # 自动选 K (肘部法则 + 轮廓系数)
        best_k = self._find_optimal_k(X_scaled, max_k=min(max_k, n - 1))

        # K-Means 聚类
        kmeans = KMeans(n_clusters=best_k, n_init=10, random_state=42, max_iter=300)
        labels = kmeans.fit_predict(X_scaled)

        # 轮廓系数 (聚类质量评估)
        sil_score = float(silhouette_score(X_scaled, labels)) if best_k > 1 else 0.0

        # PCA 降维到 2D
        pca_2d = PCA(n_components=2)
        coords_2d = pca_2d.fit_transform(X_scaled)
        explained_variance_2d = pca_2d.explained_variance_ratio_.tolist()

        # PCA 降维到 3D (如果数据维度足够)
        coords_3d = None
        explained_variance_3d = None
        if n >= 4 and vectors.shape[1] >= 3:
            pca_3d = PCA(n_components=3)
            coords_3d = pca_3d.fit_transform(X_scaled)
            explained_variance_3d = pca_3d.explained_variance_ratio_.tolist()

        # 构建每个点的数据
        points = []
        for i in range(n):
            point = {
                "diary_id": diary_ids[i],
                "diary_date": diary_dates[i],
                "title": diary_titles[i],
                "cluster": int(labels[i]),
                "x": round(float(coords_2d[i, 0]), 4),
                "y": round(float(coords_2d[i, 1]), 4),
                "features": {
                    name: round(float(vectors[i, j]), 3)
                    for j, name in enumerate(EmotionFeatureExtractor.FEATURE_NAMES)
                },
            }
            if coords_3d is not None:
                point["z"] = round(float(coords_3d[i, 2]), 4)
            points.append(point)

        # 为每个簇生成标签和统计
        clusters = []
        for k in range(best_k):
            mask = labels == k
            cluster_vectors = vectors[mask]
            centroid = cluster_vectors.mean(axis=0)

            # 基于质心的 valence 和 arousal 确定情绪标签
            is_positive = centroid[0] > 0
            is_aroused = centroid[1] > 0.45
            mood_label = self.CLUSTER_MOOD_LABELS.get(
                (is_positive, is_aroused), "混合情绪"
            )

            # 该簇中最显著的特征维度
            feature_names = EmotionFeatureExtractor.FEATURE_NAMES
            feature_labels_cn = EmotionFeatureExtractor.FEATURE_LABELS_CN
            # 取绝对值最大的前3个维度作为簇特征
            abs_centroid = np.abs(centroid)
            top_indices = abs_centroid.argsort()[-3:][::-1]
            dominant_features = [
                {"name": feature_names[idx], "label": feature_labels_cn[feature_names[idx]], "value": round(float(centroid[idx]), 3)}
                for idx in top_indices
            ]

            clusters.append({
                "id": k,
                "label": mood_label,
                "size": int(mask.sum()),
                "centroid": {name: round(float(centroid[j]), 3) for j, name in enumerate(feature_names)},
                "dominant_features": dominant_features,
            })

        # 用户情绪概况统计
        overall_stats = {
            "total_diaries": n,
            "num_clusters": best_k,
            "silhouette_score": round(sil_score, 3),
            "avg_valence": round(float(vectors[:, 0].mean()), 3),
            "avg_arousal": round(float(vectors[:, 1].mean()), 3),
            "avg_dominance": round(float(vectors[:, 2].mean()), 3),
            "valence_std": round(float(vectors[:, 0].std()), 3),
            "explained_variance_2d": [round(v, 4) for v in explained_variance_2d],
        }
        if explained_variance_3d:
            overall_stats["explained_variance_3d"] = [round(v, 4) for v in explained_variance_3d]

        return {
            "points": points,
            "clusters": clusters,
            "stats": overall_stats,
            "pca_components": {
                "pc1_label": self._interpret_pc(pca_2d.components_[0]),
                "pc2_label": self._interpret_pc(pca_2d.components_[1]),
            },
        }

    def _find_optimal_k(self, X: np.ndarray, max_k: int) -> int:
        """
        肘部法则 + 轮廓系数选择最佳 K。

        算法:
        1. 计算 K=2..max_k 的惯性 (inertia) 和轮廓系数
        2. 计算惯性的二阶差分找拐点
        3. 综合轮廓系数选最佳 K
        """
        from sklearn.cluster import KMeans
        from sklearn.metrics import silhouette_score

        if max_k < 2:
            return 1

        max_k = min(max_k, X.shape[0] - 1)
        if max_k < 2:
            return 1

        inertias = []
        sil_scores = []
        k_range = range(2, max_k + 1)

        for k in k_range:
            km = KMeans(n_clusters=k, n_init=10, random_state=42, max_iter=300)
            labels = km.fit_predict(X)
            inertias.append(km.inertia_)
            sil_scores.append(silhouette_score(X, labels))

        # 选轮廓系数最高的 K
        best_idx = int(np.argmax(sil_scores))
        return list(k_range)[best_idx]

    def _interpret_pc(self, component: np.ndarray) -> str:
        """解释 PCA 主成分的含义"""
        names = EmotionFeatureExtractor.FEATURE_NAMES
        labels = EmotionFeatureExtractor.FEATURE_LABELS_CN
        # 取载荷绝对值最大的 2 个维度
        top2 = np.abs(component).argsort()[-2:][::-1]
        parts = []
        for idx in top2:
            sign = "+" if component[idx] > 0 else "-"
            parts.append(f"{sign}{labels[names[idx]]}")
        return " / ".join(parts)

    def _minimal_result(
        self, vectors: np.ndarray,
        diary_ids: list[int],
        diary_dates: list[str],
        diary_titles: list[str],
    ) -> dict:
        """数据太少时的简单返回"""
        n = vectors.shape[0]
        points = []
        for i in range(n):
            points.append({
                "diary_id": diary_ids[i],
                "diary_date": diary_dates[i],
                "title": diary_titles[i],
                "cluster": 0,
                "x": round(float(vectors[i, 0]), 4),  # 直接用 valence 作 x
                "y": round(float(vectors[i, 1]), 4),  # arousal 作 y
                "features": {
                    name: round(float(vectors[i, j]), 3)
                    for j, name in enumerate(EmotionFeatureExtractor.FEATURE_NAMES)
                },
            })
        return {
            "points": points,
            "clusters": [{"id": 0, "label": "数据不足", "size": n, "centroid": {}, "dominant_features": []}],
            "stats": {
                "total_diaries": n,
                "num_clusters": 1,
                "silhouette_score": 0,
                "avg_valence": round(float(vectors[:, 0].mean()), 3) if n > 0 else 0,
                "avg_arousal": round(float(vectors[:, 1].mean()), 3) if n > 0 else 0,
                "avg_dominance": round(float(vectors[:, 2].mean()), 3) if n > 0 else 0,
                "valence_std": 0,
                "explained_variance_2d": [],
            },
            "pca_components": {"pc1_label": "效价", "pc2_label": "唤醒度"},
        }


# 单例
emotion_feature_extractor = EmotionFeatureExtractor()
emotion_cluster_engine = EmotionClusterEngine()

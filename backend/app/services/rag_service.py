"""
轻量RAG检索服务（无额外依赖）
对用户历史日记做切片与加权检索，供综合分析使用。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Sequence, Set


@dataclass
class DiaryChunk:
    diary_id: int
    diary_date: str
    title: str
    text: str
    source_type: str
    importance_score: int
    emotion_tags: List[str]
    emotion_intensity: float
    people: List[str]
    theme_key: str
    token_freq: Counter
    length: int


def _tokenize(text: str) -> List[str]:
    text = (text or "").lower()
    en_tokens = re.findall(r"[a-z0-9_]{2,}", text)
    zh_chars = re.findall(r"[\u4e00-\u9fff]", text)
    return en_tokens + zh_chars


def _split_into_chunks(content: str, max_len: int = 260, overlap: int = 40) -> List[str]:
    content = (content or "").strip()
    if not content:
        return []

    segments = re.split(r"[\n。！？!?；;]+", content)
    segments = [s.strip() for s in segments if s.strip()]
    chunks: List[str] = []

    current = ""
    for seg in segments:
        if len(current) + len(seg) + 1 <= max_len:
            current = f"{current} {seg}".strip()
            continue
        if current:
            chunks.append(current)
            current = current[-overlap:] + " " + seg if overlap > 0 else seg
            current = current.strip()
        else:
            chunks.append(seg[:max_len])
            current = seg[max_len - overlap:] if len(seg) > max_len else ""

    if current:
        chunks.append(current.strip())
    return chunks


def _safe_date(raw: str) -> date:
    try:
        return date.fromisoformat(str(raw))
    except Exception:
        return date.today()


def _extract_people(text: str) -> List[str]:
    text = text or ""
    relation_terms = [
        "妈妈", "爸爸", "父母", "家人", "朋友", "同事", "老板", "老师", "导师",
        "客户", "恋人", "对象", "同学", "室友", "团队"
    ]
    suffix_names = re.findall(r"[\u4e00-\u9fff]{1,3}(?:哥|姐|总|老师|同学|同事)", text)
    english_names = re.findall(r"\b[A-Z][a-z]{1,14}\b", text)
    people = relation_terms + suffix_names + english_names
    uniq = []
    seen = set()
    for p in people:
        p = p.strip()
        if not p or p in seen:
            continue
        seen.add(p)
        uniq.append(p)
    return uniq[:8]


def _estimate_emotion_intensity(text: str, emotion_tags: Sequence[str]) -> float:
    text = text or ""
    emotion_words = [
        "焦虑", "担心", "害怕", "崩溃", "愤怒", "难过", "压抑", "开心", "兴奋",
        "平静", "期待", "满足", "疲惫", "失眠", "痛苦", "放松", "感动"
    ]
    punct = text.count("!") + text.count("！") + text.count("?") + text.count("？")
    word_hits = sum(text.count(w) for w in emotion_words)
    tag_hits = len([t for t in (emotion_tags or []) if t.strip()])
    score = min(1.0, 0.08 * punct + 0.06 * word_hits + 0.08 * tag_hits)
    return round(score, 4)


def _build_daily_summary(
    diary_date: str,
    title: str,
    content: str,
    emotion_tags: Sequence[str],
    importance_score: int,
    people: Sequence[str],
) -> str:
    summary_lines = [
        f"日期：{diary_date}",
        f"标题：{title or '无标题'}",
        f"情绪：{', '.join(emotion_tags) if emotion_tags else '未标注'}",
        f"重要性：{importance_score}/10",
    ]
    if people:
        summary_lines.append(f"关键人物：{', '.join(people[:4])}")
    normalized = re.sub(r"\s+", " ", content or "").strip()
    preview = normalized[:180] + ("..." if len(normalized) > 180 else "")
    summary_lines.append(f"内容摘要：{preview or '无'}")
    return "\n".join(summary_lines)


def _theme_key(title: str, emotion_tags: Sequence[str], people: Sequence[str]) -> str:
    title_tokens = _tokenize(title)[:5]
    em_tokens = [(t or "").strip().lower() for t in (emotion_tags or []) if (t or "").strip()]
    person_tokens = [(p or "").strip().lower() for p in (people or []) if (p or "").strip()]
    parts = (title_tokens + em_tokens + person_tokens)[:6]
    if not parts:
        return "general"
    return "|".join(parts)


def _jaccard_similarity(tokens_a: Set[str], tokens_b: Set[str]) -> float:
    if not tokens_a or not tokens_b:
        return 0.0
    inter = len(tokens_a & tokens_b)
    union = len(tokens_a | tokens_b)
    if union == 0:
        return 0.0
    return inter / union


class DiaryRAGService:
    def build_chunks(self, diaries: Sequence[Dict]) -> List[DiaryChunk]:
        chunks: List[DiaryChunk] = []
        for d in diaries:
            diary_id = int(d["id"])
            diary_date = str(d["diary_date"])
            title = d.get("title") or "无标题"
            content = d.get("content") or ""
            importance_score = int(d.get("importance_score") or 5)
            emotion_tags = list(d.get("emotion_tags") or [])
            people = _extract_people(f"{title}\n{content}")
            intensity = _estimate_emotion_intensity(content, emotion_tags)
            theme = _theme_key(title, emotion_tags, people)

            summary_text = _build_daily_summary(
                diary_date=diary_date,
                title=title,
                content=content,
                emotion_tags=emotion_tags,
                importance_score=importance_score,
                people=people,
            )
            summary_tokens = _tokenize(summary_text)
            if summary_tokens:
                chunks.append(
                    DiaryChunk(
                        diary_id=diary_id,
                        diary_date=diary_date,
                        title=title,
                        text=summary_text,
                        source_type="summary",
                        importance_score=importance_score,
                        emotion_tags=emotion_tags,
                        emotion_intensity=intensity,
                        people=people,
                        theme_key=theme,
                        token_freq=Counter(summary_tokens),
                        length=len(summary_tokens),
                    )
                )

            for chunk_text in _split_into_chunks(content):
                tokens = _tokenize(f"{title} {chunk_text}")
                if not tokens:
                    continue
                chunks.append(
                    DiaryChunk(
                        diary_id=diary_id,
                        diary_date=diary_date,
                        title=title,
                        text=chunk_text,
                        source_type="raw",
                        importance_score=importance_score,
                        emotion_tags=emotion_tags,
                        emotion_intensity=intensity,
                        people=people,
                        theme_key=theme,
                        token_freq=Counter(tokens),
                        length=len(tokens),
                    )
                )
        return chunks

    def retrieve(
        self,
        chunks: Sequence[DiaryChunk],
        query: str,
        top_k: int = 8,
        source_types: Optional[Set[str]] = None,
    ) -> List[Dict]:
        if not chunks:
            return []

        filtered_chunks = [c for c in chunks if source_types is None or c.source_type in source_types]
        if not filtered_chunks:
            return []

        query_tokens = _tokenize(query)
        if not query_tokens:
            return []

        N = len(filtered_chunks)
        avgdl = sum(c.length for c in filtered_chunks) / max(N, 1)
        latest_date = max((_safe_date(c.diary_date) for c in filtered_chunks), default=date.today())

        theme_to_diaries: Dict[str, Set[int]] = defaultdict(set)
        for c in filtered_chunks:
            theme_to_diaries[c.theme_key].add(c.diary_id)

        df = defaultdict(int)
        for c in filtered_chunks:
            for t in set(c.token_freq.keys()):
                df[t] += 1

        k1 = 1.5
        b = 0.75
        scored: List[Dict] = []
        for c in filtered_chunks:
            bm25_score = 0.0
            for t in query_tokens:
                if t not in c.token_freq:
                    continue
                idf = math.log(1 + (N - df[t] + 0.5) / (df[t] + 0.5))
                tf = c.token_freq[t]
                denom = tf + k1 * (1 - b + b * (c.length / max(avgdl, 1e-6)))
                bm25_score += idf * (tf * (k1 + 1) / max(denom, 1e-6))
            if bm25_score <= 0:
                continue

            days_ago = max((latest_date - _safe_date(c.diary_date)).days, 0)
            recency = math.exp(-days_ago / 45.0)
            importance = max(0.0, min(1.0, c.importance_score / 10.0))
            emotion = max(0.0, min(1.0, c.emotion_intensity))
            repetition = max(0.0, min(1.0, (len(theme_to_diaries.get(c.theme_key, set())) - 1) / 3.0))

            query_text = (query or "").lower()
            people_hit = 0.0
            if c.people:
                people_hit = 0.25
                if any((p.lower() in query_text) for p in c.people):
                    people_hit = 1.0

            source_bonus = 0.4 if c.source_type == "summary" else 0.0
            scored.append(
                {
                    "chunk": c,
                    "bm25_score": bm25_score,
                    "recency": recency,
                    "importance": importance,
                    "emotion_intensity": emotion,
                    "repetition": repetition,
                    "people_hit": people_hit,
                    "source_bonus": source_bonus,
                }
            )

        if not scored:
            return []

        max_bm25 = max(item["bm25_score"] for item in scored) or 1.0
        for item in scored:
            bm25_norm = item["bm25_score"] / max_bm25
            item["score"] = (
                0.55 * bm25_norm
                + 0.14 * item["recency"]
                + 0.09 * item["importance"]
                + 0.08 * item["emotion_intensity"]
                + 0.08 * item["repetition"]
                + 0.04 * item["people_hit"]
                + 0.02 * item["source_bonus"]
            )

        scored.sort(key=lambda x: x["score"], reverse=True)
        result: List[Dict] = []
        for item in scored[:top_k]:
            c: DiaryChunk = item["chunk"]
            result.append(
                {
                    "diary_id": c.diary_id,
                    "diary_date": c.diary_date,
                    "title": c.title,
                    "snippet": c.text[:240],
                    "score": round(float(item["score"]), 4),
                    "bm25_score": round(float(item["bm25_score"]), 4),
                    "source_type": c.source_type,
                    "importance_score": c.importance_score,
                    "emotion_intensity": c.emotion_intensity,
                    "people": c.people[:4],
                }
            )
        return result

    def deduplicate_evidence(
        self,
        candidates: Sequence[Dict],
        max_total: int = 18,
        max_per_diary: int = 2,
        per_reason_limit: int = 3,
        similarity_threshold: float = 0.72,
    ) -> List[Dict]:
        if not candidates:
            return []

        sorted_candidates = sorted(candidates, key=lambda x: float(x.get("score", 0.0)), reverse=True)
        picked: List[Dict] = []
        diary_count: Dict[int, int] = defaultdict(int)
        reason_count: Dict[str, int] = defaultdict(int)
        fingerprints: List[Set[str]] = []

        for item in sorted_candidates:
            if len(picked) >= max_total:
                break
            diary_id = int(item.get("diary_id", 0))
            reason = str(item.get("reason") or "未分类")
            if diary_count[diary_id] >= max_per_diary:
                continue
            if reason_count[reason] >= per_reason_limit:
                continue

            token_set = set(_tokenize(item.get("snippet") or ""))
            duplicated = any(_jaccard_similarity(token_set, fp) >= similarity_threshold for fp in fingerprints)
            if duplicated:
                continue

            picked.append(item)
            diary_count[diary_id] += 1
            reason_count[reason] += 1
            fingerprints.append(token_set)

        return picked


diary_rag_service = DiaryRAGService()

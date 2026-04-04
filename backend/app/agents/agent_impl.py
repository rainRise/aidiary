"""
AI Agent 系统 - Agent实现
"""
import json
import re
import time
from typing import Dict, List, Any
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.state import AnalysisState
from app.agents.prompts import (
    CONTEXT_COLLECTOR_PROMPT,
    TIMELINE_EXTRACTOR_PROMPT,
    SATIR_EMOTION_PROMPT,
    SATIR_BELIEF_PROMPT,
    SATIR_EXISTENCE_PROMPT,
    SATIR_RESPONDER_PROMPT,
    SOCIAL_POST_CREATOR_PROMPT,
    SYSTEM_PROMPT_ANALYST
)
from app.agents.llm import get_llm, get_analytical_llm, get_creative_llm


def _parse_json_payload(raw: str) -> Dict[str, Any]:
    """
    尽最大可能从LLM响应中提取JSON对象。
    兼容：纯JSON、```json 代码块、前后夹杂说明文字。
    """
    if raw is None:
        raise ValueError("LLM返回为空（None）")

    text = raw.strip().lstrip("\ufeff")
    if not text:
        raise ValueError("LLM返回为空字符串")

    # 1) 直接解析
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass

    # 2) markdown 代码块
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fenced:
        block = fenced.group(1).strip()
        try:
            obj = json.loads(block)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    # 3) 使用 JSONDecoder 从第一个 '{' 位置增量解码，忽略后续附加文本
    decoder = json.JSONDecoder()
    first_brace = text.find("{")
    if first_brace != -1:
        try:
            obj, _idx = decoder.raw_decode(text[first_brace:])
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass

    raise ValueError(f"无法从LLM响应中解析JSON: {text[:240]}")


def _begin_agent_run(state: AnalysisState, agent_code: str, agent_name: str, model: str, step: str) -> Dict[str, Any]:
    run = {
        "agent_code": agent_code,
        "agent_name": agent_name,
        "model": model,
        "step": step,
        "status": "running",
        "started_at": time.time(),
    }
    state.setdefault("agent_runs", []).append(run)
    return run


def _finish_agent_run(run: Dict[str, Any], ok: bool, error: str = "") -> None:
    ended_at = time.time()
    run["ended_at"] = ended_at
    run["duration_ms"] = int((ended_at - run["started_at"]) * 1000)
    run["status"] = "success" if ok else "error"
    if error:
        run["error"] = error


class ContextCollectorAgent:
    """Agent 0: 上下文收集器"""

    def __init__(self):
        self.llm = get_llm(temperature=0.3)
        self.agent_code = "0"
        self.agent_name = "Context Collector"

    async def collect(self, state: AnalysisState, user_profile: Dict, timeline_context: List[Dict]):
        """收集上下文信息"""
        print(f"[Agent {self.agent_code} | {self.agent_name}] 收集上下文...")
        run = _begin_agent_run(
            state=state,
            agent_code=self.agent_code,
            agent_name=self.agent_name,
            model=getattr(self.llm, "model", "unknown"),
            step="context_collection",
        )

        try:
            # 构建prompt（注入RAG历史记忆）
            memories = state.get("related_memories") or []
            if memories:
                memories_text = json.dumps(memories, ensure_ascii=False, indent=2)
            else:
                memories_text = "无（尚未检索到相关历史记忆）"

            prompt = CONTEXT_COLLECTOR_PROMPT.format(
                user_profile=json.dumps(user_profile, ensure_ascii=False, indent=2),
                timeline_context=json.dumps(timeline_context, ensure_ascii=False, indent=2),
                related_memories=memories_text,
                diary_content=state["diary_content"]
            )

            # 调用LLM
            messages = [
                SystemMessage(content="你是一个智能助手，负责分析用户上下文。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm.ainvoke(messages, response_format="json")
            result = _parse_json_payload(response.content)

            # 更新状态
            state["user_profile"] = user_profile
            state["timeline_context"] = timeline_context

            print(f"[Agent {self.agent_code} | {self.agent_name}] 上下文收集完成: {result.get('current_mood', 'N/A')}")
            _finish_agent_run(run, ok=True)
            return state

        except Exception as e:
            print(f"[Agent {self.agent_code} | {self.agent_name}] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            state["user_profile"] = user_profile
            state["timeline_context"] = timeline_context
            return state


class TimelineManagerAgent:
    """Agent A: 时间线管家"""

    def __init__(self):
        self.llm = get_llm(temperature=0.5)
        self.agent_code = "A"
        self.agent_name = "Timeline Manager"

    async def extract_event(self, state: AnalysisState):
        """提取时间轴事件"""
        print(f"[Agent {self.agent_code} | {self.agent_name}] 提取时间轴事件...")
        run = _begin_agent_run(
            state=state,
            agent_code=self.agent_code,
            agent_name=self.agent_name,
            model=getattr(self.llm, "model", "unknown"),
            step="timeline_extraction",
        )

        try:
            prompt = TIMELINE_EXTRACTOR_PROMPT.format(
                diary_content=state["diary_content"]
            )

            messages = [
                SystemMessage(content="你是一个专业的事件提取助手。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm.ainvoke(messages, response_format="json")
            result = _parse_json_payload(response.content)

            # 构建时间轴事件
            event = {
                "event_summary": result.get("event_summary", "未命名事件"),
                "emotion_tag": result.get("emotion_tag", "未分类"),
                "importance_score": result.get("importance_score", 5),
                "event_type": result.get("event_type", "other"),
                "related_entities": result.get("entities", {})
            }

            state["timeline_event"] = event

            print(f"[Agent {self.agent_code} | {self.agent_name}] 事件提取完成: {event['event_summary']}")
            _finish_agent_run(run, ok=True)
            return state

        except Exception as e:
            print(f"[Agent {self.agent_code} | {self.agent_name}] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            # 降级：创建默认事件
            state["timeline_event"] = {
                "event_summary": "日记记录",
                "emotion_tag": "记录",
                "importance_score": 5,
                "event_type": "other",
                "related_entities": {}
            }
            return state


class SatirTherapistAgent:
    """Agent B: 萨提亚分析师"""

    def __init__(self):
        self.llm_emotion = get_analytical_llm()
        self.llm_belief = get_analytical_llm()
        self.llm_existence = get_llm(temperature=0.6)
        self.llm_responder = get_llm(temperature=0.8)

    async def analyze_emotion_layer(self, state: AnalysisState):
        """分析情绪层（第2层）"""
        print("[Agent B1 | Satir Emotion Analyst] 分析情绪层...")
        run = _begin_agent_run(
            state=state,
            agent_code="B1",
            agent_name="Satir Emotion Analyst",
            model=getattr(self.llm_emotion, "model", "unknown"),
            step="satir_emotion",
        )

        try:
            prompt = SATIR_EMOTION_PROMPT.format(
                diary_content=state["diary_content"],
                user_profile=json.dumps(state.get("user_profile", {}), ensure_ascii=False)
            )

            messages = [
                SystemMessage(content="你是萨提亚冰山模型专家。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm_emotion.ainvoke(messages, response_format="json")
            result = _parse_json_payload(response.content)

            state["emotion_layer"] = result
            print(f"[Agent B1 | Satir Emotion Analyst] 情绪层分析: {result.get('surface_emotion', 'N/A')} -> {result.get('underlying_emotion', 'N/A')}")
            _finish_agent_run(run, ok=True)

        except Exception as e:
            print(f"[Agent B1 | Satir Emotion Analyst] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            state["emotion_layer"] = {
                "surface_emotion": "未识别",
                "underlying_emotion": "未识别",
                "emotion_intensity": 5,
                "emotion_analysis": "分析失败"
            }

        return state

    async def analyze_belief_layer(self, state: AnalysisState):
        """分析信念层（第3-4层）"""
        print("[Agent B2 | Satir Belief Analyst] 分析信念层...")
        run = _begin_agent_run(
            state=state,
            agent_code="B2",
            agent_name="Satir Belief Analyst",
            model=getattr(self.llm_belief, "model", "unknown"),
            step="satir_belief",
        )

        try:
            prompt = SATIR_BELIEF_PROMPT.format(
                diary_content=state["diary_content"],
                emotion_analysis=json.dumps(state.get("emotion_layer", {}), ensure_ascii=False)
            )

            messages = [
                SystemMessage(content="你是萨提亚冰山模型专家。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm_belief.ainvoke(messages, response_format="json")
            result = _parse_json_payload(response.content)

            state["cognitive_layer"] = {
                "irrational_beliefs": result.get("irrational_beliefs", []),
                "automatic_thoughts": result.get("automatic_thoughts", [])
            }
            state["belief_layer"] = {
                "core_beliefs": result.get("core_beliefs", []),
                "life_rules": result.get("life_rules", []),
                "belief_analysis": result.get("belief_analysis", "")
            }

            print("[Agent B2 | Satir Belief Analyst] 信念层分析完成")
            _finish_agent_run(run, ok=True)

        except Exception as e:
            print(f"[Agent B2 | Satir Belief Analyst] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            state["cognitive_layer"] = {"irrational_beliefs": [], "automatic_thoughts": []}
            state["belief_layer"] = {"core_beliefs": [], "life_rules": [], "belief_analysis": ""}

        return state

    async def analyze_existence_layer(self, state: AnalysisState):
        """分析存在层（第5层）"""
        print("[Agent B3 | Satir Existence Analyst] 分析存在层...")
        run = _begin_agent_run(
            state=state,
            agent_code="B3",
            agent_name="Satir Existence Analyst",
            model=getattr(self.llm_existence, "model", "unknown"),
            step="satir_existence",
        )

        try:
            # 构建完整的分析摘要
            all_analysis = {
                "emotion_layer": state.get("emotion_layer", {}),
                "cognitive_layer": state.get("cognitive_layer", {}),
                "belief_layer": state.get("belief_layer", {})
            }

            prompt = SATIR_EXISTENCE_PROMPT.format(
                diary_content=state["diary_content"],
                all_analysis=json.dumps(all_analysis, ensure_ascii=False, indent=2)
            )

            messages = [
                SystemMessage(content="你是萨提亚冰山模型专家。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm_existence.ainvoke(messages, response_format="json")
            result = _parse_json_payload(response.content)

            state["core_self_layer"] = result
            print(f"[Agent B3 | Satir Existence Analyst] 存在层分析: {result.get('deepest_desire', 'N/A')}")
            _finish_agent_run(run, ok=True)

        except Exception as e:
            print(f"[Agent B3 | Satir Existence Analyst] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            state["core_self_layer"] = {
                "yearnings": [],
                "life_energy": "未知",
                "deepest_desire": "未识别",
                "existence_insight": "分析失败"
            }

        return state

    async def generate_response(self, state: AnalysisState):
        """生成疗愈回复（Node B4）"""
        print("[Agent B4 | Satir Responder] 生成疗愈回复...")
        run = _begin_agent_run(
            state=state,
            agent_code="B4",
            agent_name="Satir Responder",
            model=getattr(self.llm_responder, "model", "unknown"),
            step="satir_response",
        )

        try:
            # 构建完整的冰山分析
            iceberg_analysis = {
                "behavior_layer": {"event": state.get("diary_content", "")[:100] + "..."},
                "emotion_layer": state.get("emotion_layer", {}),
                "cognitive_layer": state.get("cognitive_layer", {}),
                "belief_layer": state.get("belief_layer", {}),
                "core_self_layer": state.get("core_self_layer", {})
            }

            prompt = SATIR_RESPONDER_PROMPT.format(
                user_profile=json.dumps(state.get("user_profile", {}), ensure_ascii=False),
                diary_content=state["diary_content"],
                iceberg_analysis=json.dumps(iceberg_analysis, ensure_ascii=False, indent=2)
            )

            messages = [
                SystemMessage(content=SYSTEM_PROMPT_ANALYST),
                HumanMessage(content=prompt)
            ]

            response = await self.llm_responder.ainvoke(messages)
            therapeutic_response = response.content.strip()

            state["therapeutic_response"] = therapeutic_response
            print(f"[Agent B4 | Satir Responder] 回复生成完成: {therapeutic_response[:50]}...")
            _finish_agent_run(run, ok=True)

        except Exception as e:
            print(f"[Agent B4 | Satir Responder] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            state["therapeutic_response"] = "感谢你愿意记录下这段经历。你的感受是真实的，你的经历是有意义的。"

        return state


class SocialContentCreatorAgent:
    """Agent C: 社交内容生成器"""

    def __init__(self):
        self.llm = get_creative_llm()
        self.agent_code = "C"
        self.agent_name = "Social Content Creator"

    async def generate_posts(self, state: AnalysisState, user_profile: Dict):
        """生成朋友圈文案"""
        print(f"[Agent {self.agent_code} | {self.agent_name}] 生成朋友圈文案...")
        run = _begin_agent_run(
            state=state,
            agent_code=self.agent_code,
            agent_name=self.agent_name,
            model=getattr(self.llm, "model", "unknown"),
            step="social_content_generation",
        )

        try:
            prompt = SOCIAL_POST_CREATOR_PROMPT.format(
                username=user_profile.get("username", "用户"),
                social_style=user_profile.get("social_style", "真实"),
                catchphrases=", ".join(user_profile.get("catchphrases", [])),
                diary_content=state["diary_content"],
                emotion_tags=", ".join(state.get("timeline_event", {}).get("emotion_tag", "未分类").split(",") if isinstance(state.get("timeline_event", {}).get("emotion_tag"), str) else "未分类")
            )

            messages = [
                SystemMessage(content="你是社交媒体文案创作专家。"),
                HumanMessage(content=prompt)
            ]

            response = await self.llm.ainvoke(messages)
            raw = response.content.strip()

            # 尝试多种方式解析JSON
            result = None
            # 1. 直接解析
            try:
                result = json.loads(raw)
            except json.JSONDecodeError:
                pass

            # 2. 提取markdown代码块中的JSON
            if result is None:
                json_match = re.search(r'```(?:json)?\s*\n?(\{.*?\})\s*```', raw, re.DOTALL)
                if json_match:
                    try:
                        result = json.loads(json_match.group(1))
                    except json.JSONDecodeError:
                        pass

            # 3. 提取第一个 { ... } 块
            if result is None:
                brace_match = re.search(r'(\{.*\})', raw, re.DOTALL)
                if brace_match:
                    try:
                        result = json.loads(brace_match.group(1))
                    except json.JSONDecodeError:
                        pass

            if result is None:
                raise ValueError(f"无法解析JSON响应: {raw[:200]}")

            state["social_posts"] = result.get("posts", [])
            print(f"[Agent {self.agent_code} | {self.agent_name}] 文案生成完成: {len(state['social_posts'])}个版本")
            _finish_agent_run(run, ok=True)

        except Exception as e:
            print(f"[Agent {self.agent_code} | {self.agent_name}] 错误: {e}")
            _finish_agent_run(run, ok=False, error=str(e))
            # 降级：生成简单文案
            content = state["diary_content"][:50]
            state["social_posts"] = [
                {
                    "version": "A",
                    "style": "简洁版",
                    "content": f"今天记录：{content}..."
                },
                {
                    "version": "B",
                    "style": "完整版",
                    "content": state["diary_content"][:100]
                }
            ]

        return state

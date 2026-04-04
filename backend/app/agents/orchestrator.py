"""
AI Agent 系统 - 编排器
协调多个Agent完成完整的分析流程
"""
import time
import asyncio
from typing import Dict, List

from app.agents.agent_impl import (
    ContextCollectorAgent,
    TimelineManagerAgent,
    SatirTherapistAgent,
    SocialContentCreatorAgent
)
from app.agents.state import AnalysisState


class AgentOrchestrator:
    """Agent编排器 - 协调多个Agent工作"""

    def __init__(self):
        self.context_collector = ContextCollectorAgent()
        self.timeline_manager = TimelineManagerAgent()
        self.satir_therapist = SatirTherapistAgent()
        self.social_creator = SocialContentCreatorAgent()

    async def analyze_diary(
        self,
        user_id: int,
        diary_id: int,
        diary_content: str,
        diary_date,
        user_profile: Dict,
        timeline_context: List[Dict],
        related_memories: List[Dict] = None,
    ) -> Dict:
        """
        完整的日记分析流程

        Args:
            user_id: 用户ID
            diary_id: 日记ID
            diary_content: 日记内容
            diary_date: 日记日期
            user_profile: 用户画像
            timeline_context: 时间轴上下文
            related_memories: RAG检索到的相关历史日记记忆

        Returns:
            Dict: 分析结果
        """
        start_time = time.time()

        # 初始化状态
        state: AnalysisState = {
            "user_id": user_id,
            "diary_id": diary_id,
            "diary_content": diary_content,
            "diary_date": diary_date,
            "user_profile": user_profile,
            "timeline_context": timeline_context,
            "related_memories": related_memories or [],
            "behavior_layer": {},
            "emotion_layer": {},
            "cognitive_layer": {},
            "belief_layer": {},
            "core_self_layer": {},
            "timeline_event": {},
            "social_posts": [],
            "therapeutic_response": "",
            "processing_time": 0,
            "error": None,
            "current_step": "initialize",
            "agent_runs": []
        }

        print("\n" + "="*60)
        print("印记 - AI分析系统")
        print("="*60)
        print(f"\n用户ID: {user_id}")
        print(f"日记ID: {diary_id}")
        print(f"日记日期: {diary_date}")
        print(f"\n开始分析...\n")

        try:
            # Step 0: 收集上下文
            state["current_step"] = "context_collection"
            state = await self.context_collector.collect(state, user_profile, timeline_context)

            # Step 1: 提取时间轴事件
            state["current_step"] = "timeline_extraction"
            state = await self.timeline_manager.extract_event(state)

            # Step 2: 萨提亚分析（五层冰山）
            state["current_step"] = "satir_analysis"

            # 2.1 情绪层
            state = await self.satir_therapist.analyze_emotion_layer(state)

            # 2.2 信念层
            state = await self.satir_therapist.analyze_belief_layer(state)

            # 2.3 存在层
            state = await self.satir_therapist.analyze_existence_layer(state)

            # 2.4 生成回复
            state = await self.satir_therapist.generate_response(state)

            # Step 3: 生成社交文案
            state["current_step"] = "social_content_generation"
            state = await self.social_creator.generate_posts(state, user_profile)

            # 计算处理时间
            state["processing_time"] = time.time() - start_time

            print(f"\n{'='*60}")
            print("分析完成！")
            print(f"总耗时: {state['processing_time']:.2f}秒")
            print(f"{'='*60}\n")

            return state

        except Exception as e:
            print(f"\n[ERROR] 分析失败: {e}")
            import traceback
            traceback.print_exc()

            state["error"] = str(e)
            state["processing_time"] = time.time() - start_time

            # 返回错误状态
            return state

    async def analyze_iceberg(
        self,
        username: str,
        period: str,
        diary_count: int,
        evidence_text: str,
    ) -> Dict:
        """
        综合冰山分析：基于 RAG 证据，逐层调用大模型完成五层冰山 + 疗愈信。

        Returns:
            Dict with keys: behavior_layer, emotion_layer, cognition_layer,
                            belief_layer, yearning_layer, letter, agent_runs
        """
        import json as _json
        from app.agents.llm import deepseek_client
        from app.agents.prompts import (
            ICEBERG_BEHAVIOR_PROMPT,
            ICEBERG_EMOTION_PROMPT,
            ICEBERG_COGNITION_PROMPT,
            ICEBERG_BELIEF_PROMPT,
            ICEBERG_YEARNING_PROMPT,
            ICEBERG_LETTER_PROMPT,
        )

        agent_runs: List[Dict] = []
        start_time = time.time()

        def _record(code: str, name: str, ok: bool, t0: float, error: str = ""):
            run = {
                "agent_code": code,
                "agent_name": name,
                "status": "success" if ok else "error",
                "duration_ms": int((time.time() - t0) * 1000),
            }
            if error:
                run["error"] = error
            agent_runs.append(run)

        async def _call_json(prompt: str, step_code: str, step_name: str) -> Dict:
            t0 = time.time()
            try:
                raw = await deepseek_client.chat_with_system(
                    system_prompt="你是萨提亚冰山模型专家。只输出JSON，不要附加解释。",
                    user_prompt=prompt,
                    temperature=0.4,
                    response_format="json",
                )
                from app.api.v1.ai import _safe_parse_json
                result = _safe_parse_json(raw)
                _record(step_code, step_name, True, t0)
                print(f"[Iceberg {step_code}] {step_name} 完成 ({int((time.time()-t0)*1000)}ms)")
                return result
            except Exception as e:
                _record(step_code, step_name, False, t0, str(e))
                print(f"[Iceberg {step_code}] {step_name} 失败: {e}")
                return {}

        print(f"\n{'='*60}")
        print(f"印记 - 冰山综合分析")
        print(f"用户: {username} | 窗口: {period} | 日记数: {diary_count}")
        print(f"{'='*60}\n")

        # ── Step A: 行为层 ──
        behavior_result = await _call_json(
            ICEBERG_BEHAVIOR_PROMPT.format(
                username=username, period=period,
                diary_count=diary_count, evidence_text=evidence_text,
            ),
            "A", "行为模式识别",
        )

        # ── Step B: 情绪层 ──
        emotion_result = await _call_json(
            ICEBERG_EMOTION_PROMPT.format(
                username=username, period=period,
                behavior_result=_json.dumps(behavior_result, ensure_ascii=False),
                evidence_text=evidence_text,
            ),
            "B", "情绪层分析",
        )

        # ── Step C: 认知层 ──
        cognition_result = await _call_json(
            ICEBERG_COGNITION_PROMPT.format(
                username=username,
                behavior_result=_json.dumps(behavior_result, ensure_ascii=False),
                emotion_result=_json.dumps(emotion_result, ensure_ascii=False),
                evidence_text=evidence_text,
            ),
            "C", "认知层分析",
        )

        # ── Step D: 信念层 ──
        belief_result = await _call_json(
            ICEBERG_BELIEF_PROMPT.format(
                username=username,
                behavior_result=_json.dumps(behavior_result, ensure_ascii=False),
                emotion_result=_json.dumps(emotion_result, ensure_ascii=False),
                cognition_result=_json.dumps(cognition_result, ensure_ascii=False),
                evidence_text=evidence_text,
            ),
            "D", "信念层分析",
        )

        # ── Step E: 渴望层 ──
        all_layers = _json.dumps({
            "behavior": behavior_result,
            "emotion": emotion_result,
            "cognition": cognition_result,
            "belief": belief_result,
        }, ensure_ascii=False, indent=2)

        yearning_result = await _call_json(
            ICEBERG_YEARNING_PROMPT.format(
                username=username,
                all_layers=all_layers,
                evidence_text=evidence_text,
            ),
            "E", "渴望层分析",
        )

        # ── Step F: 致你的一封信 ──
        all_layers_with_yearning = _json.dumps({
            "behavior": behavior_result,
            "emotion": emotion_result,
            "cognition": cognition_result,
            "belief": belief_result,
            "yearning": yearning_result,
        }, ensure_ascii=False, indent=2)

        letter = ""
        t0 = time.time()
        try:
            letter = await deepseek_client.chat_with_system(
                system_prompt="你是用户最温暖的日记伙伴。写一封真挚的信。",
                user_prompt=ICEBERG_LETTER_PROMPT.format(
                    username=username,
                    period=period,
                    all_layers=all_layers_with_yearning,
                ),
                temperature=0.8,
            )
            letter = (letter or "").strip()
            _record("F", "疗愈信生成", True, t0)
            print(f"[Iceberg F] 疗愈信生成 完成 ({int((time.time()-t0)*1000)}ms)")
        except Exception as e:
            _record("F", "疗愈信生成", False, t0, str(e))
            letter = f"亲爱的{username}：\n\n感谢你愿意记录下这段旅程。你的每一次书写，都是在靠近真实的自己。\n\n你的日记伙伴"

        total_ms = int((time.time() - start_time) * 1000)
        print(f"\n冰山分析完成！总耗时: {total_ms}ms\n")

        return {
            "behavior_layer": behavior_result,
            "emotion_layer": emotion_result,
            "cognition_layer": cognition_result,
            "belief_layer": belief_result,
            "yearning_layer": yearning_result,
            "letter": letter,
            "agent_runs": agent_runs,
            "processing_time": total_ms / 1000,
        }

    def format_result(self, state: AnalysisState) -> Dict:
        """
        格式化分析结果用于返回

        Args:
            state: 分析状态

        Returns:
            Dict: 格式化的结果
        """
        return {
            "diary_id": state["diary_id"],
            "user_id": state["user_id"],
            "timeline_event": state.get("timeline_event", {}),
            "satir_analysis": {
                "behavior_layer": state.get("behavior_layer", {}),
                "emotion_layer": state.get("emotion_layer", {}),
                "cognitive_layer": state.get("cognitive_layer", {}),
                "belief_layer": state.get("belief_layer", {}),
                "core_self_layer": state.get("core_self_layer", {}),
            },
            "therapeutic_response": state.get("therapeutic_response", ""),
            "social_posts": state.get("social_posts", []),
            "metadata": {
                "processing_time": state.get("processing_time", 0),
                "current_step": state.get("current_step", ""),
                "error": state.get("error"),
                "workflow": ["0", "A", "B1", "B2", "B3", "B4", "C"],
                "workflow_detail": [
                    {"code": "0", "agent": "上下文收集智能体", "subtask": "汇总画像/时间轴上下文"},
                    {"code": "A", "agent": "时间线管家", "subtask": "提取事件并结构化"},
                    {"code": "B1", "agent": "萨提亚分析师", "subtask": "情绪层分析"},
                    {"code": "B2", "agent": "萨提亚分析师", "subtask": "认知与信念层分析"},
                    {"code": "B3", "agent": "萨提亚分析师", "subtask": "存在层分析"},
                    {"code": "B4", "agent": "萨提亚分析师", "subtask": "疗愈回复生成"},
                    {"code": "C", "agent": "社交内容生成器", "subtask": "多版本文案输出"},
                ],
                "agent_runs": state.get("agent_runs", [])
            }
        }


# 创建全局实例
agent_orchestrator = AgentOrchestrator()

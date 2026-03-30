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
        timeline_context: List[Dict]
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
            "related_memories": [],
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

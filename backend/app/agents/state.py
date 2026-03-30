"""
AI Agent 系统 - 状态管理
定义LangGraph工作流的状态
"""
from typing import TypedDict, List, Dict, Optional, Annotated
from datetime import date
from langgraph.graph import MessagesState


class AnalysisState(TypedDict):
    """分析状态 - LangGraph工作流的状态"""

    # 输入
    user_id: int
    diary_id: int
    diary_content: str
    diary_date: date

    # 上下文数据（由Agent 0收集）
    user_profile: Dict
    timeline_context: List[Dict]
    related_memories: List[Dict]

    # 萨提亚冰山五层分析（由Agent B生成）
    behavior_layer: Dict
    emotion_layer: Dict
    cognitive_layer: Dict
    belief_layer: Dict
    core_self_layer: Dict

    # 时间轴事件（由Agent A生成）
    timeline_event: Dict

    # 社交内容（由Agent C生成）
    social_posts: List[Dict]

    # 输出
    therapeutic_response: str

    # 元数据
    processing_time: float
    error: Optional[str]
    current_step: str
    agent_runs: List[Dict]

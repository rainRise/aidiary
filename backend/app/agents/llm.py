"""
DeepSeek API 客户端
简化版LLM调用，避免复杂的依赖
"""
import os
import httpx
import json
from typing import Dict, List, Optional

from app.core.config import settings


class DeepSeekClient:
    """DeepSeek API客户端"""

    def __init__(self):
        self.api_key = settings.deepseek_api_key
        self.base_url = settings.deepseek_base_url
        self.model = "deepseek-chat"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[str] = None
    ) -> str:
        """
        调用DeepSeek聊天API

        Args:
            messages: 消息列表 [{"role": "user", "content": "..."}]
            temperature: 温度参数（0-1）
            max_tokens: 最大token数
            response_format: 响应格式（可选：json_object）

        Returns:
            str: AI响应内容
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }

        # 如果需要JSON格式输出
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            result = response.json()

            return result["choices"][0]["message"]["content"]

    async def chat_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        response_format: Optional[str] = None
    ) -> str:
        """
        使用系统提示词的聊天

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            temperature: 温度参数
            response_format: 响应格式

        Returns:
            str: AI响应内容
        """
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        return await self.chat(messages, temperature, response_format=response_format)


# 创建全局实例
deepseek_client = DeepSeekClient()


# 为了兼容性，创建ChatOpenAI的替代类
class ChatOpenAI:
    """兼容langchain的LLM接口"""

    def __init__(self, model: str, openai_api_key: str, base_url: str, temperature: float = 0.7, max_tokens: int = 2000):
        self.client = DeepSeekClient()
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def ainvoke(self, messages, response_format: Optional[str] = None):
        """异步调用（兼容langchain）"""
        # 提取system和user消息
        system_msg = None
        user_msgs = []

        for msg in messages:
            if hasattr(msg, 'type'):
                if msg.type == "system":
                    system_msg = msg.content
                else:
                    user_msgs.append(msg.content)
            else:
                if msg["role"] == "system":
                    system_msg = msg["content"]
                else:
                    user_msgs.append(msg["content"])

        # 构建prompt
        if system_msg:
            user_prompt = "\n".join(user_msgs)
            result = await self.client.chat_with_system(
                system_prompt=system_msg,
                user_prompt=user_prompt,
                temperature=self.temperature,
                response_format=response_format
            )
        else:
            # 没有system prompt，直接使用messages
            result = await self.client.chat(
                messages=messages,
                temperature=self.temperature,
                response_format=response_format
            )

        # 返回兼容langchain的Message对象
        class Message:
            def __init__(self, content):
                self.content = content

        return Message(content=result)


def get_llm(temperature: float = 0.7):
    """获取DeepSeek LLM实例"""
    return ChatOpenAI(
        model="deepseek-chat",
        openai_api_key=settings.deepseek_api_key,
        base_url=settings.deepseek_base_url,
        temperature=temperature
    )


def get_creative_llm():
    """获取创意型LLM"""
    return get_llm(temperature=0.9)


def get_analytical_llm():
    """获取分析型LLM"""
    return get_llm(temperature=0.3)

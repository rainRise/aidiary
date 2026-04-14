"""
LLM 客户端
支持 DeepSeek 和 Gemini 模型
"""
import httpx
import json
import logging
from typing import Dict, List, Optional, AsyncGenerator

from app.core.config import settings

logger = logging.getLogger(__name__)


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
            self._log_prompt_cache_usage(result, stream=False)

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

    async def stream_chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        """
        调用 DeepSeek 流式聊天 API，逐 token yield

        Args:
            messages: 消息列表
            temperature: 温度参数

        Yields:
            str: 每个 token 的文本片段
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "stream": True,
            # OpenAI-compatible stream usage summary (DeepSeek supports OpenAI-compatible API)
            "stream_options": {"include_usage": True},
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        # Final usage chunk
                        if chunk.get("usage"):
                            self._log_prompt_cache_usage(chunk, stream=True)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                    except Exception:
                        continue

    def _log_prompt_cache_usage(self, response_json: Dict, stream: bool = False) -> None:
        """
        记录 DeepSeek Prompt Cache 命中情况，便于持续优化提示词并降低成本。
        DeepSeek 上下文缓存默认开启，无需额外开关。
        """
        usage = response_json.get("usage") or {}
        hit = usage.get("prompt_cache_hit_tokens")
        miss = usage.get("prompt_cache_miss_tokens")

        # 兼容没有返回 usage 或未返回缓存字段的情况
        if hit is None and miss is None:
            return

        hit = int(hit or 0)
        miss = int(miss or 0)
        prompt_tokens = int(usage.get("prompt_tokens") or (hit + miss) or 0)
        total_prompt = max(hit + miss, prompt_tokens, 1)
        hit_rate = hit / total_prompt

        # 命中价通常远低于未命中价，这里按 10x 仅做相对估算，不涉及币种
        relative_cost = miss + (hit * 0.1)
        baseline_cost = miss + hit
        saved_ratio = 0.0 if baseline_cost <= 0 else (1 - relative_cost / baseline_cost)

        logger.info(
            "[DeepSeekCache][%s] model=%s prompt_tokens=%s hit=%s miss=%s "
            "hit_rate=%.2f%% est_saved=%.2f%%",
            "stream" if stream else "sync",
            response_json.get("model", self.model),
            prompt_tokens,
            hit,
            miss,
            hit_rate * 100,
            saved_ratio * 100,
        )


class GeminiClient:
    """Gemini API 客户端"""

    def __init__(self):
        self.api_key = settings.gemini_api_key
        self.base_url = settings.gemini_base_url
        self.model = "gemini-2.0-flash"

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str = "gemini-2.0-flash",
        temperature: float = 0.7,
        max_tokens: int = 2000,
    ) -> str:
        """调用 Gemini 聊天 API"""
        # 提取 system 和 user 消息
        system_content = ""
        user_content = ""
        
        for msg in messages:
            if msg.get("role") == "system":
                system_content = msg.get("content", "")
            elif msg.get("role") == "user":
                user_content = msg.get("content", "")

        # 构建 Gemini 格式的内容
        contents = []
        if system_content:
            parts = [{"text": system_content}]
            contents.append({"role": "user", "parts": parts})
        
        if user_content:
            parts = [{"text": user_content}]
            contents.append({"role": "model", "parts": parts})

        headers = {
            "Content-Type": "application/json"
        }

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "topP": 0.95,
                "topK": 40
            }
        }

        url = f"{self.base_url}/models/{model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            result = response.json()

            try:
                return result["candidates"][0]["content"]["parts"][0]["text"]
            except (KeyError, IndexError):
                logger.error(f"Gemini API 返回格式异常: {result}")
                raise ValueError("Gemini API 响应格式异常")

    async def chat_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str = "gemini-2.0-flash",
        temperature: float = 0.7,
    ) -> str:
        """使用系统提示词的聊天"""
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        return await self.chat(messages, model, temperature)


# 创建全局实例
deepseek_client = DeepSeekClient()
gemini_client = GeminiClient()


class MultiModelClient:
    """多模型客户端，支持 DeepSeek 和 Gemini"""

    def __init__(self, default_model: str = "deepseek"):
        self.default_model = default_model

    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[str] = None
    ) -> str:
        """调用聊天API"""
        model = model or self.default_model

        if model.startswith("gemini"):
            return await gemini_client.chat(messages, model, temperature, max_tokens)
        else:
            return await deepseek_client.chat(messages, temperature, max_tokens, response_format)

    async def chat_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        model: Optional[str] = None,
        temperature: float = 0.7,
        response_format: Optional[str] = None
    ) -> str:
        """使用系统提示词的聊天"""
        model = model or self.default_model
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        return await self.chat(messages, model, temperature, response_format=response_format)


# 多模型全局实例
multi_model_client = MultiModelClient()


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

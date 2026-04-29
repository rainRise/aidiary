"""
DeepSeek API 客户端
简化版LLM调用，避免复杂的依赖
"""
import asyncio
import httpx
import json
import logging
from typing import Any, Dict, List, Optional, AsyncGenerator
from urllib.parse import urljoin

from app.core.config import settings

logger = logging.getLogger(__name__)


class DeepSeekClient:
    """DeepSeek API客户端"""

    def __init__(self):
        self.api_key = settings.deepseek_api_key
        self.base_url = settings.deepseek_base_url.rstrip("/")
        self.model = settings.deepseek_model

    def _chat_completions_url(self) -> str:
        """
        DeepSeek 官方 OpenAI-compatible base_url 现在是 https://api.deepseek.com。
        这里兼容旧配置里的 /v1，避免拼出 /v1/chat/completions 这类过期路径。
        """
        base = self.base_url
        if base.endswith("/v1"):
            base = base[:-3].rstrip("/")
        return urljoin(f"{base}/", "chat/completions")

    def _extract_message_content(self, result: Dict[str, Any]) -> str:
        """兼容 OpenAI-style 文本或多段 content，统一提取最终回复文本。"""
        choices = result.get("choices") or []
        if not choices:
            return ""

        message = choices[0].get("message") or {}
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = []
            for item in content:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    text = item.get("text") or item.get("content")
                    if text:
                        parts.append(str(text))
            return "".join(parts).strip()

        return ""

    def _empty_response_reason(self, result: Dict[str, Any]) -> str:
        choices = result.get("choices") or []
        if not choices:
            return "no_choices"

        choice = choices[0]
        message = choice.get("message") or {}
        finish_reason = choice.get("finish_reason") or "unknown"
        refusal = message.get("refusal")
        reasoning = message.get("reasoning_content")
        return (
            f"finish_reason={finish_reason}, "
            f"has_reasoning={bool(reasoning)}, "
            f"has_refusal={bool(refusal)}"
        )

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        response_format: Optional[str] = None,
        timeout_seconds: float = 60.0,
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
            # Reasoning-capable兼容模型可能先输出 reasoning_content。
            # max_tokens 太低时会出现 finish_reason=length 且 content 为空，因此给 JSON/分析任务留出更稳的输出余量。
            "max_tokens": max(max_tokens, 3200),
            "stream": False
        }

        # 如果需要JSON格式输出
        if response_format == "json":
            payload["response_format"] = {"type": "json_object"}

        retryable_statuses = {429, 500, 502, 503, 504}
        max_attempts = 3
        last_empty_reason = ""

        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            for attempt in range(1, max_attempts + 1):
                try:
                    response = await client.post(
                        self._chat_completions_url(),
                        headers=headers,
                        json=payload
                    )
                    try:
                        response.raise_for_status()
                    except httpx.HTTPStatusError as exc:
                        logger.error(
                            "DeepSeek API request failed status=%s url=%s body=%s",
                            exc.response.status_code,
                            exc.request.url,
                            exc.response.text[:800],
                        )
                        if exc.response.status_code in retryable_statuses and attempt < max_attempts:
                            await asyncio.sleep(0.7 * attempt)
                            continue
                        raise

                    result = response.json()
                    self._log_prompt_cache_usage(result, stream=False)
                    content = self._extract_message_content(result)
                    if content:
                        return content

                    last_empty_reason = self._empty_response_reason(result)
                    logger.warning(
                        "DeepSeek returned empty content attempt=%s/%s model=%s %s",
                        attempt,
                        max_attempts,
                        payload["model"],
                        last_empty_reason,
                    )
                    if attempt < max_attempts:
                        await asyncio.sleep(0.6 * attempt)
                        continue
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    if attempt < max_attempts:
                        logger.warning(
                            "DeepSeek request transport error attempt=%s/%s: %s",
                            attempt,
                            max_attempts,
                            exc,
                        )
                        await asyncio.sleep(0.7 * attempt)
                        continue
                    raise

        raise ValueError(f"DeepSeek返回为空（{last_empty_reason or 'unknown'}）")

    async def chat_with_system(
        self,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.7,
        response_format: Optional[str] = None,
        max_tokens: int = 2000,
        timeout_seconds: float = 60.0,
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

        return await self.chat(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format=response_format,
            timeout_seconds=timeout_seconds,
        )

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
                self._chat_completions_url(),
                headers=headers,
                json=payload
            ) as response:
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as exc:
                    body = await exc.response.aread()
                    logger.error(
                        "DeepSeek stream request failed status=%s url=%s body=%s",
                        exc.response.status_code,
                        exc.request.url,
                        body.decode("utf-8", errors="ignore")[:800],
                    )
                    raise
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
        model=settings.deepseek_model,
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

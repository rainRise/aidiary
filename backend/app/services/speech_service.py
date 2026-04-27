"""
讯飞语音听写服务（IAT WebSocket）
"""
import asyncio
import base64
import hashlib
import hmac
import io
import json
import wave
from email.utils import formatdate
from urllib.parse import quote

import websockets

from app.core.config import settings


class SpeechService:
    def __init__(self) -> None:
        self.host = "iat-api.xfyun.cn"
        self.path = "/v2/iat"

    @staticmethod
    def _appid() -> str:
        appid = (settings.xfyun_iat_appid or "").strip()
        if appid.upper().startswith("APPID"):
            appid = appid[5:].strip()
        return appid

    @staticmethod
    def _api_key() -> str:
        return (settings.xfyun_iat_api_key or "").strip()

    @staticmethod
    def _api_secret() -> str:
        return (settings.xfyun_iat_api_secret or "").strip()

    def is_configured(self) -> bool:
        return bool(
            self._appid()
            and self._api_key()
            and self._api_secret()
        )

    def _build_ws_url(self) -> str:
        date = formatdate(timeval=None, localtime=False, usegmt=True)
        signature_origin = f"host: {self.host}\n" f"date: {date}\n" f"GET {self.path} HTTP/1.1"
        signature_sha = hmac.new(
            self._api_secret().encode("utf-8"),
            signature_origin.encode("utf-8"),
            digestmod=hashlib.sha256,
        ).digest()
        signature = base64.b64encode(signature_sha).decode("utf-8")

        authorization_origin = (
            f'api_key="{self._api_key()}", '
            f'algorithm="hmac-sha256", '
            f'headers="host date request-line", '
            f'signature="{signature}"'
        )
        authorization = base64.b64encode(authorization_origin.encode("utf-8")).decode("utf-8")
        return (
            f"wss://{self.host}{self.path}"
            f"?authorization={quote(authorization)}"
            f"&date={quote(date)}"
            f"&host={self.host}"
        )

    @staticmethod
    def _extract_pcm_from_wav(wav_bytes: bytes) -> bytes:
        with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
            channels = wf.getnchannels()
            sample_width = wf.getsampwidth()
            sample_rate = wf.getframerate()
            if channels != 1:
                raise ValueError("仅支持单声道音频")
            if sample_width != 2:
                raise ValueError("仅支持16-bit PCM音频")
            if sample_rate != 16000:
                raise ValueError("仅支持16kHz音频")
            return wf.readframes(wf.getnframes())

    async def transcribe_wav(self, wav_bytes: bytes) -> str:
        if not self.is_configured():
            raise ValueError("语音识别服务未配置")

        pcm_bytes = self._extract_pcm_from_wav(wav_bytes)
        if not pcm_bytes:
            return ""

        ws_url = self._build_ws_url()
        frame_size = 1280  # 40ms @ 16kHz, 16bit mono
        result_parts: list[str] = []

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=20, close_timeout=8) as ws:
            index = 0
            first_frame = True

            while index < len(pcm_bytes):
                chunk = pcm_bytes[index:index + frame_size]
                index += frame_size
                status = 0 if first_frame else (2 if index >= len(pcm_bytes) else 1)
                first_frame = False

                payload: dict = {
                    "data": {
                        "status": status,
                        "format": "audio/L16;rate=16000",
                        "audio": base64.b64encode(chunk).decode("utf-8"),
                        "encoding": "raw",
                    }
                }
                if status == 0:
                    payload["common"] = {"app_id": self._appid()}
                    payload["business"] = {
                        "domain": "iat",
                        "language": "zh_cn",
                        "accent": "mandarin",
                        "vad_eos": 10000,
                    }

                await ws.send(json.dumps(payload))
                await asyncio.sleep(0.04)

                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=3.5)
                    msg = json.loads(response)
                    if msg.get("code", 0) != 0:
                        raise ValueError(msg.get("message", "语音识别失败"))
                    data = msg.get("data", {})
                    result = data.get("result", {})
                    ws_items = result.get("ws", [])
                    text = "".join(
                        cw.get("w", "")
                        for item in ws_items
                        for cw in item.get("cw", [])
                    )
                    if text:
                        result_parts.append(text)
                except asyncio.TimeoutError:
                    pass

            for _ in range(6):
                try:
                    response = await asyncio.wait_for(ws.recv(), timeout=1.6)
                except asyncio.TimeoutError:
                    break
                msg = json.loads(response)
                if msg.get("code", 0) != 0:
                    break
                data = msg.get("data", {})
                result = data.get("result", {})
                ws_items = result.get("ws", [])
                text = "".join(
                    cw.get("w", "")
                    for item in ws_items
                    for cw in item.get("cw", [])
                )
                if text:
                    result_parts.append(text)
                if data.get("status") == 2:
                    break

        return "".join(result_parts).strip()


speech_service = SpeechService()

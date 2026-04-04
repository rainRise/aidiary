"""
滑动拼图验证码服务
- 生成随机缺口位置 + 签名 token
- 校验用户滑动的 x 坐标是否在误差范围内
- 校验滑动耗时（防机器人秒过）
"""
import time
import secrets
import hashlib
import hmac
from typing import Optional, Tuple

from app.core.config import settings

# 拼图参数
PUZZLE_WIDTH = 300       # 背景宽度 (逻辑像素)
PUZZLE_HEIGHT = 180      # 背景高度
PIECE_SIZE = 44          # 拼图块大小
MARGIN = 50              # 缺口距边缘最小距离
TOLERANCE = 6            # 允许的像素误差
MIN_DURATION_MS = 300    # 最短滑动时间（防自动化）
TOKEN_EXPIRE_SEC = 120   # token 有效期（秒）

# 用密钥签名，防止伪造
_SECRET = (settings.secret_key + ":captcha").encode()

# 已使用的 token（内存级防重放，进程重启清空可接受）
_used_tokens: set = set()
_used_tokens_ts: dict = {}   # token -> 创建时间，用于定期清理


def _sign(payload: str) -> str:
    """HMAC-SHA256 签名"""
    return hmac.new(_SECRET, payload.encode(), hashlib.sha256).hexdigest()


def _cleanup_used():
    """清理过期的已用 token（超过 5 分钟）"""
    now = time.time()
    expired = [t for t, ts in _used_tokens_ts.items() if now - ts > 300]
    for t in expired:
        _used_tokens.discard(t)
        _used_tokens_ts.pop(t, None)


def generate() -> dict:
    """
    生成验证码数据，返回给前端：
    - target_x:  缺口的 x 坐标（前端绘制缺口用）
    - target_y:  缺口的 y 坐标
    - token:     签名 token（前端提交校验时带回）
    """
    import random
    target_x = random.randint(MARGIN + PIECE_SIZE, PUZZLE_WIDTH - MARGIN)
    target_y = random.randint(MARGIN, PUZZLE_HEIGHT - MARGIN - PIECE_SIZE)
    created = int(time.time())
    nonce = secrets.token_hex(8)

    payload = f"{target_x}:{target_y}:{created}:{nonce}"
    sig = _sign(payload)
    token = f"{payload}:{sig}"

    return {
        "target_x": target_x,
        "target_y": target_y,
        "token": token,
        "piece_size": PIECE_SIZE,
        "bg_width": PUZZLE_WIDTH,
        "bg_height": PUZZLE_HEIGHT,
    }


def verify(token: str, slide_x: float, duration_ms: int) -> Tuple[bool, str]:
    """
    校验用户滑动结果。
    返回 (success, message)
    """
    _cleanup_used()

    if not token or not isinstance(slide_x, (int, float)):
        return False, "参数无效"

    # 解析 token
    parts = token.split(":")
    if len(parts) != 5:
        return False, "token 格式错误"

    try:
        target_x = int(parts[0])
        target_y = int(parts[1])
        created = int(parts[2])
        nonce = parts[3]
        sig = parts[4]
    except (ValueError, IndexError):
        return False, "token 解析失败"

    # 验签
    payload = f"{target_x}:{target_y}:{created}:{nonce}"
    expected_sig = _sign(payload)
    if not hmac.compare_digest(sig, expected_sig):
        return False, "token 签名无效"

    # 过期检查
    if time.time() - created > TOKEN_EXPIRE_SEC:
        return False, "验证已过期，请重新操作"

    # 防重放
    if token in _used_tokens:
        return False, "该验证已使用，请重新操作"

    # 滑动时间检查
    if duration_ms < MIN_DURATION_MS:
        return False, "操作过快，请重试"

    # 坐标误差检查
    if abs(slide_x - target_x) > TOLERANCE:
        return False, "验证失败，请重试"

    # 标记已使用
    _used_tokens.add(token)
    _used_tokens_ts[token] = time.time()

    return True, "验证通过"


def mark_used(token: str):
    """在发送验证码成功后标记 token 已使用（防止同一 captcha 发多次）"""
    _used_tokens.add(token)
    _used_tokens_ts[token] = time.time()


captcha_service = type("CaptchaService", (), {
    "generate": staticmethod(generate),
    "verify": staticmethod(verify),
    "mark_used": staticmethod(mark_used),
})()

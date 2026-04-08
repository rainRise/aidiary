"""
印记 - Smart Diary Application
FastAPI主应用
"""
import os
import asyncio
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import init_db
from app.api.v1 import auth
from app.api.v1.auth import router as auth_router
from app.services.scheduler_service import scheduler_loop

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    print("[INFO] Initializing database...")
    await init_db()
    print("[INFO] Database initialized successfully")

    # 启动每日定时分析任务
    scheduler_task = asyncio.create_task(scheduler_loop())
    print("[INFO] Daily scheduler started")

    yield

    # 关闭时取消定时任务
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass
    print("[INFO] Application shutdown")


# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="基于RAG知识库的智能日记应用",
    lifespan=lifespan,
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 安全响应头中间件
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


def _error_payload(
    *,
    request: Request,
    code: int,
    message: str,
    data=None,
):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return {
        "code": code,
        "message": message,
        "data": data,
        "request_id": request_id,
        # 兼容旧前端 err.response.data.detail 的读取逻辑
        "detail": message,
    }


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else "Request failed"
    data = None if isinstance(detail, str) else detail
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_payload(request=request, code=exc.status_code, message=message, data=data),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = ".".join(str(i) for i in loc if i != "body")
        errors.append({
            "field": field or "request",
            "message": err.get("msg", "Invalid value"),
            "type": err.get("type", "validation_error"),
        })
    return JSONResponse(
        status_code=422,
        content=_error_payload(
            request=request,
            code=422,
            message="Validation failed",
            data={"errors": errors},
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error", exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=_error_payload(
            request=request,
            code=500,
            message="Internal server error",
            data=None,
        ),
    )


app.add_middleware(RequestIdMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# 注册路由
app.include_router(auth_router, prefix="/api/v1", tags=["认证"])

# 导入并注册日记路由
from app.api.v1 import diaries
app.include_router(diaries.router, prefix="/api/v1", tags=["日记"])

# 导入并注册AI路由
from app.api.v1 import ai
app.include_router(ai.router, prefix="/api/v1", tags=["AI分析"])

# 导入并注册用户画像路由
from app.api.v1 import users
app.include_router(users.router, prefix="/api/v1", tags=["用户"])

# 导入并注册社区路由
from app.api.v1 import community
app.include_router(community.router, prefix="/api/v1", tags=["社区"])

# 导入并注册映记精灵路由
from app.api.v1 import assistant
app.include_router(assistant.router, prefix="/api/v1", tags=["映记精灵"])

# 导入并注册外部接入路由
from app.api.v1 import integrations
app.include_router(integrations.router, prefix="/api/v1", tags=["外部接入"])

# 导入并注册情绪特征分析路由
from app.api.v1 import emotion
app.include_router(emotion.router, prefix="/api/v1", tags=["情绪特征分析"])

# 挂载静态文件目录
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(os.path.join(UPLOADS_DIR, "avatars"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "diary_images"), exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "community_images"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/", tags=["根路径"])
async def root():
    """根路径"""
    return {
        "app": settings.app_name,
        "version": settings.app_version,
        "status": "running"
    }


@app.get("/health", tags=["健康检查"])
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "database": "connected"
    }


@app.get("/api/openapi.json", include_in_schema=False)
async def openapi_alias():
    """标准化 API Schema 入口（兼容 /api/doc）"""
    return JSONResponse(app.openapi())


@app.get("/api/doc", include_in_schema=False)
async def swagger_ui_alias():
    """标准化 Swagger 文档入口"""
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title=f"{settings.app_name} API Docs",
    )


@app.get("/api/docs", include_in_schema=False)
async def swagger_ui_alias_docs():
    """兼容部分团队习惯使用 /api/docs"""
    return get_swagger_ui_html(
        openapi_url="/api/openapi.json",
        title=f"{settings.app_name} API Docs",
    )


@app.get("/api/redoc", include_in_schema=False)
async def redoc_alias():
    """标准化 Redoc 文档入口"""
    return get_redoc_html(
        openapi_url="/api/openapi.json",
        title=f"{settings.app_name} API Redoc",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )

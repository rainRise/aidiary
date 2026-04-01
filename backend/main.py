"""
印记 - Smart Diary Application
FastAPI主应用
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.db import init_db
from app.api.v1 import auth
from app.api.v1.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时初始化数据库
    print("[INFO] Initializing database...")
    await init_db()
    print("[INFO] Database initialized successfully")

    yield

    # 关闭时的清理工作
    print("[INFO] Application shutdown")


# 创建FastAPI应用
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="基于RAG知识库的智能日记应用",
    lifespan=lifespan
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )

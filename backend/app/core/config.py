"""
应用配置管理
使用 pydantic-settings 管理环境变量
"""
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置"""

    # ==================== 应用配置 ====================
    app_name: str = Field(default="印记", description="应用名称")
    app_version: str = Field(default="0.1.0", description="应用版本")
    debug: bool = Field(default=False, description="调试模式")
    allowed_origins: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        description="允许的CORS源（逗号分隔）"
    )

    # ==================== 数据库配置 ====================
    database_url: str = Field(
        default="sqlite+aiosqlite:///./yinji.db",
        description="数据库连接URL"
    )

    # ==================== JWT认证配置 ====================
    secret_key: str = Field(
        ...,
        description="JWT密钥（必须设置）"
    )
    algorithm: str = Field(default="HS256", description="JWT算法")
    access_token_expire_minutes: int = Field(
        default=10080,
        description="访问令牌过期时间（分钟）默认7天"
    )

    # ==================== SMTP邮箱配置 ====================
    smtp_host: str = Field(
        default="smtp.qq.com",
        description="SMTP服务器地址"
    )
    smtp_port: int = Field(
        default=465,
        description="SMTP端口"
    )
    smtp_secure: bool = Field(
        default=True,
        description="是否使用SSL"
    )
    smtp_email: str = Field(
        default="",
        description="发件人邮箱地址（新字段，推荐）"
    )
    smtp_password: str = Field(
        default="",
        description="SMTP密码/授权码（新字段，推荐）"
    )
    smtp_sender_name: str = Field(
        default="印记",
        description="发件人显示名称"
    )

    # 兼容旧版 QQ 配置（平滑迁移）
    qq_email: str = Field(
        default="",
        description="旧字段：QQ邮箱地址（兼容）"
    )
    qq_email_auth_code: str = Field(
        default="",
        description="旧字段：QQ邮箱授权码（兼容）"
    )

    @property
    def smtp_username(self) -> str:
        """优先使用新字段，否则回退旧字段"""
        return self.smtp_email or self.qq_email

    @property
    def smtp_secret(self) -> str:
        """优先使用新字段，否则回退旧字段"""
        return self.smtp_password or self.qq_email_auth_code

    @property
    def email_sender(self) -> str:
        """获取完整的发件人字符串（包含显示名称）"""
        sender_email = self.smtp_username
        if self.smtp_sender_name:
            return f"{self.smtp_sender_name} <{sender_email}>"
        return sender_email

    # ==================== 验证码配置 ====================
    verification_code_expire_minutes: int = Field(
        default=5,
        description="验证码过期时间（分钟）"
    )
    max_code_requests_per_5min: int = Field(
        default=3,
        description="5分钟内最大请求次数"
    )

    # ==================== DeepSeek API配置 ====================
    deepseek_api_key: str = Field(
        default="",
        description="DeepSeek API密钥"
    )
    deepseek_base_url: str = Field(
        default="https://api.deepseek.com/v1",
        description="DeepSeek API地址"
    )

    # ==================== Qdrant 向量检索配置 ====================
    qdrant_url: str = Field(
        default="",
        description="Qdrant 集群地址，如 https://xxx.qdrant.io"
    )
    qdrant_api_key: str = Field(
        default="",
        description="Qdrant API Key"
    )
    qdrant_collection: str = Field(
        default="yinji_diary_memory",
        description="Qdrant 集合名"
    )
    qdrant_vector_dim: int = Field(
        default=256,
        description="Qdrant 向量维度（需与编码函数一致）"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def cors_origins(self) -> List[str]:
        """解析CORS允许的源列表"""
        return [origin.strip() for origin in self.allowed_origins.split(",")]


# 全局配置实例
settings = Settings()

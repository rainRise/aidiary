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
        ...,
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
        ...,
        description="发件人邮箱地址"
    )
    smtp_password: str = Field(
        ...,
        description="SMTP密码/授权码"
    )
    smtp_sender_name: str = Field(
        default="印记",
        description="发件人显示名称"
    )

    # ==================== 管理员初始化 ====================
    bootstrap_admin_email: str = Field(
        default="",
        description="启动时自动创建/提升管理员账号邮箱"
    )
    bootstrap_admin_password: str = Field(
        default="",
        description="启动时自动创建管理员账号密码"
    )
    bootstrap_admin_username: str = Field(
        default="管理员",
        description="启动时自动创建管理员账号用户名"
    )

    @property
    def email_sender(self) -> str:
        """获取完整的发件人字符串（包含显示名称）"""
        if self.smtp_sender_name:
            return f"{self.smtp_sender_name} <{self.smtp_email}>"
        return self.smtp_email

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
        default="https://api.deepseek.com",
        description="DeepSeek API地址"
    )
    deepseek_model: str = Field(
        default="deepseek-v4-flash",
        description="DeepSeek模型名称"
    )

    # ==================== 讯飞语音听写配置 ====================
    xfyun_iat_appid: str = Field(
        default="",
        description="讯飞语音听写 APPID"
    )
    xfyun_iat_api_key: str = Field(
        default="",
        description="讯飞语音听写 API Key"
    )
    xfyun_iat_api_secret: str = Field(
        default="",
        description="讯飞语音听写 API Secret"
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

    # ==================== 周报调度配置 ====================
    counselor_digest_weekday: int = Field(
        default=0,
        description="辅导员/心理老师周报推送日，0=周一"
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

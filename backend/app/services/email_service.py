"""
邮件服务
使用 SMTP 发送验证码邮件
支持 aiosmtplib 和内置 smtplib
"""
import asyncio
import random
import string
import smtplib
from datetime import datetime, timedelta
from typing import Optional
from email.message import EmailMessage

from app.core.config import settings

# 尝试导入 aiosmtplib，如果失败则使用内置 smtplib
try:
    import aiosmtplib
    USE_ASYNC_SMTP = True
except ImportError:
    USE_ASYNC_SMTP = False
    print("Warning: aiosmtplib not installed, using synchronous smtplib")


class EmailService:
    """邮件服务类"""

    def __init__(self):
        self.smtp_host = settings.smtp_host
        self.smtp_port = settings.smtp_port
        self.smtp_secure = settings.smtp_secure
        self.email = settings.smtp_username
        self.password = settings.smtp_secret
        self.sender_name = settings.smtp_sender_name
        self.sender = settings.email_sender

    @staticmethod
    def generate_code(length: int = 6) -> str:
        """
        生成随机验证码

        Args:
            length: 验证码长度，默认6位

        Returns:
            str: 验证码
        """
        return ''.join(random.choices(string.digits, k=length))

    async def send_verification_email(
        self,
        to_email: str,
        code: str,
        code_type: str = "register"
    ) -> bool:
        """
        发送验证码邮件

        Args:
            to_email: 收件人邮箱
            code: 验证码
            code_type: 验证码类型（register/login）

        Returns:
            bool: 是否发送成功
        """
        # 根据类型选择邮件主题和内容
        if code_type == "register":
            subject = "【印记】注册验证码"
            body = f"""
您好！

欢迎使用印记！

您的注册验证码是：{code}

验证码有效期为5分钟，请尽快完成注册。

如果这不是您的操作，请忽略此邮件。

---
印记 - 智能日记，记录美好生活
            """.strip()
        elif code_type == "reset":
            subject = "【印记】重置密码验证码"
            body = f"""
您好！

您正在重置印记账号密码。

您的验证码是：{code}

验证码有效期为5分钟，请尽快完成密码重置。

如果这不是您的操作，请忽略此邮件并确保您的账号安全。

---
印记 - 智能日记，记录美好生活
            """.strip()
        else:  # login
            subject = "【印记】登录验证码"
            body = f"""
您好！

您的登录验证码是：{code}

验证码有效期为5分钟，请尽快完成登录。

如果这不是您的操作，请忽略此邮件。

---
印记 - 智能日记，记录美好生活
            """.strip()

        # 创建邮件消息
        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body, charset="utf-8")

        try:
            if USE_ASYNC_SMTP:
                # 使用异步方式发送邮件
                if self.smtp_secure:
                    # 使用SSL（465端口）
                    await aiosmtplib.send(
                        message,
                        hostname=self.smtp_host,
                        port=self.smtp_port,
                        username=self.email,
                        password=self.password,
                        use_tls=True
                    )
                else:
                    # 使用STARTTLS（587端口）
                    await aiosmtplib.send(
                        message,
                        hostname=self.smtp_host,
                        port=self.smtp_port,
                        username=self.email,
                        password=self.password,
                        start_tls=True
                    )
            else:
                # 使用同步方式发送邮件（在线程池中执行）
                await asyncio.to_thread(
                    self._send_email_sync,
                    message
                )

            return True

        except Exception as e:
            print(f"发送邮件失败: {e}")
            return False

    def _send_email_sync(self, message: EmailMessage):
        """
        使用同步方式发送邮件

        Args:
            message: 邮件消息
        """
        if self.smtp_secure:
            # 使用SSL
            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.email, self.password)
                server.send_message(message)
        else:
            # 使用STARTTLS
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.email, self.password)
                server.send_message(message)

    async def send_test_email(self, to_email: str) -> bool:
        """
        发送测试邮件

        Args:
            to_email: 收件人邮箱

        Returns:
            bool: 是否发送成功
        """
        subject = "【印记】邮件服务测试"
        body = """
您好！

这是一封测试邮件，用于验证印记应用的邮件服务是否正常工作。

如果您收到此邮件，说明邮件服务配置成功！

---
印记 - 智能日记，记录美好生活
        """.strip()

        message = EmailMessage()
        message["From"] = self.sender
        message["To"] = to_email
        message["Subject"] = subject
        message.set_content(body, charset="utf-8")

        try:
            if USE_ASYNC_SMTP:
                await aiosmtplib.send(
                    message,
                    hostname=self.smtp_host,
                    port=self.smtp_port,
                    username=self.email,
                    password=self.password,
                    use_tls=True
                )
            else:
                await asyncio.to_thread(
                    self._send_email_sync,
                    message
                )
            return True
        except Exception as e:
            print(f"发送测试邮件失败: {e}")
            return False


# 创建全局实例
email_service = EmailService()

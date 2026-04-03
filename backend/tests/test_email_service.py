"""
单元测试 - 邮件服务
测试验证码生成、邮件发送等
"""
import pytest
from app.services.email_service import EmailService, email_service


class TestEmailService:
    """测试邮件服务"""

    def test_generate_code_default_length(self):
        """测试生成默认长度验证码"""
        code = email_service.generate_code()

        # 验证码应该是字符串
        assert isinstance(code, str)
        # 默认长度应该是6位
        assert len(code) == 6
        # 应该全是数字
        assert code.isdigit()

    def test_generate_code_custom_length(self):
        """测试生成自定义长度验证码"""
        code = email_service.generate_code(length=4)

        # 长度应该是4位
        assert len(code) == 4
        # 应该全是数字
        assert code.isdigit()

    def test_generate_code_uniqueness(self):
        """测试验证码唯一性"""
        codes = [email_service.generate_code() for _ in range(100)]

        # 100个验证码应该都不同（虽然理论上可能重复，但概率极低）
        unique_codes = set(codes)
        assert len(unique_codes) > 95  # 允许少量重复

    def test_email_service_initialization(self):
        """测试邮件服务初始化"""
        service = EmailService()

        # 检查配置
        assert service.smtp_host == "smtpdm-ap-southeast-1.aliyuncs.com"
        assert service.smtp_port == 465
        assert service.smtp_secure is True
        assert service.email == "noreply@yingjiapp.com"
        assert service.password == "YinjiMail2026AI"
        assert service.sender_name == "YinJi 映记"


@pytest.mark.asyncio
class TestEmailSending:
    """测试邮件发送功能"""

    async def test_send_test_email_success(self):
        """测试发送测试邮件"""
        # 使用真实邮箱测试
        test_email = "2337590486@qq.com"

        # 发送测试邮件
        success = await email_service.send_test_email(test_email)

        # 应该成功
        assert success is True

    async def test_send_verification_email_register(self):
        """测试发送注册验证码邮件"""
        test_email = "2337590486@qq.com"
        code = "123456"

        # 发送注册验证码邮件
        success = await email_service.send_verification_email(
            test_email,
            code,
            "register"
        )

        # 应该成功
        assert success is True

    async def test_send_verification_email_login(self):
        """测试发送登录验证码邮件"""
        test_email = "2337590486@qq.com"
        code = "654321"

        # 发送登录验证码邮件
        success = await email_service.send_verification_email(
            test_email,
            code,
            "login"
        )

        # 应该成功
        assert success is True

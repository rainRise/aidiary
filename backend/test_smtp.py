"""
测试阿里云 SMTP 邮件发送
验证配置是否正确
"""
import asyncio
from app.services.email_service import email_service

async def test_smtp():
    """测试SMTP配置"""
    print("=" * 60)
    print("测试阿里云 SMTP 邮件发送")
    print("=" * 60)
    
    # 显示配置信息
    print("\n📧 当前配置:")
    print(f"   SMTP 服务器: {email_service.smtp_host}")
    print(f"   端口: {email_service.smtp_port}")
    print(f"   SSL: {email_service.smtp_secure}")
    print(f"   发件人: {email_service.sender}")
    
    # 输入测试邮箱
    test_email = input("\n请输入接收测试邮件的邮箱地址: ").strip()
    
    if not test_email:
        print("❌ 邮箱地址不能为空")
        return
    
    print(f"\n📤 正在发送测试邮件到: {test_email}")
    
    try:
        success = await email_service.send_test_email(test_email)
        
        if success:
            print("\n✅ 测试邮件发送成功！")
            print("请检查收件箱（包括垃圾邮件文件夹）")
        else:
            print("\n❌ 测试邮件发送失败")
            print("请检查:")
            print("  1. SMTP 服务器地址是否正确")
            print("  2. SMTP 密码是否正确")
            print("  3. 发件人邮箱是否已验证")
            print("  4. 网络连接是否正常")
    except Exception as e:
        print(f"\n❌ 发送过程出错: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(test_smtp())

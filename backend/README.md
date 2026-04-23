# 印记 (YinJi) - Backend

基于RAG知识库的智能日记应用后端服务

## 技术栈

- **框架**: FastAPI 0.109.0
- **数据库**: SQLite (开发) / PostgreSQL 16 (生产)
- **ORM**: SQLAlchemy 2.0 (异步)
- **认证**: JWT (python-jose)
- **邮件**: 阿里云 SMTP (aiosmtplib)
- **AI**: DeepSeek V3 API

## 快速开始

### 1. 安装依赖

```bash
# 进入后端目录
cd backend

# 创建虚拟环境（推荐）
python -m venv venv

# 激活虚拟环境
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
# 复制配置文件模板
cp .env.example .env

# 编辑 .env 文件，配置必要参数
# 必须配置项：
# - SECRET_KEY: JWT密钥（生产环境请使用 openssl rand -hex 32 生成）
# - SMTP_EMAIL: 发件人邮箱地址
# - SMTP_PASSWORD: SMTP密码
```

### 3. 运行应用

```bash
# 开发模式（自动重载）
python main.py

# 或使用 uvicorn
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

启动成功后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API端点

### 认证相关

- `POST /api/v1/auth/register/send-code` - 发送注册验证码
- `POST /api/v1/auth/register/verify` - 验证注册验证码
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login/send-code` - 发送登录验证码
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/logout` - 用户登出
- `GET /api/v1/auth/me` - 获取当前用户信息

### 测试邮件

- `GET /api/v1/auth/test-email?email=your@email.com` - 测试邮件发送

## 项目结构

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── auth.py         # 认证API端点
│   │       └── ...
│   ├── core/
│   │   ├── config.py           # 配置管理
│   │   ├── security.py         # JWT、密码哈希
│   │   └── deps.py             # 依赖注入
│   ├── models/
│   │   └── database.py         # SQLAlchemy模型
│   ├── schemas/
│   │   └── auth.py             # Pydantic schemas
│   ├── services/
│   │   ├── email_service.py    # 邮件服务
│   │   └── auth_service.py     # 认证服务
│   └── db.py                   # 数据库连接
├── main.py                     # 应用入口
├── requirements.txt            # 依赖列表
├── .env                        # 环境变量（不提交）
└── .env.example                # 环境变量模板
```

## 开发计划

- [x] Phase 1.1: 项目结构搭建
- [x] Phase 1.2: 邮箱认证功能
- [ ] Phase 2: 日记管理功能
- [ ] Phase 3: AI Agent系统
- [ ] Phase 4: 前端开发

## 部署说明

### 切换到PostgreSQL

修改 `.env` 文件：

```bash
# 注释掉SQLite
# DATABASE_URL=sqlite+aiosqlite:///./yinji.db

# 使用PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/yinji
```

### 使用Docker部署

```bash
# 构建镜像
docker build -t yinji-backend .

# 运行容器
docker run -d -p 8000:8000 --env-file .env yinji-backend
```

## 常见问题

### 1. QQ邮件发送失败

- 确认已开启SMTP服务
- 确认授权码正确（不是QQ密码）
- 确认SMTP端口正确（465用于SSL）

### 2. 数据库初始化失败

- 删除 `yinji.db` 文件
- 重启应用

### 3. JWT验证失败

- 检查 SECRET_KEY 是否配置
- 确认令牌未过期

## 许可证

MIT

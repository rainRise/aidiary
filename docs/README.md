# 印记 - 智能日记应用

基于RAG知识库的智能日记应用，帮助你记录和回顾生活的美好瞬间。

## 🌟 项目特性

- 📝 **智能日记** - 支持富文本编辑，记录每一天
- 🤖 **AI分析** - 基于DeepSeek的智能情感分析和内容总结
- 🔐 **邮箱验证** - 安全的邮箱验证码登录/注册
- 📊 **知识图谱** - RAG技术构建个人知识库
- 🎨 **现代UI** - 基于React + TailwindCSS的精美界面

## 🏗️ 技术栈

### 后端
- **FastAPI** - 现代Python Web框架
- **SQLAlchemy** - ORM数据库操作
- **SQLite** - 轻量级数据库
- **JWT** - 用户认证
- **SMTP** - 邮件发送

### 前端
- **React 18** - UI框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **TailwindCSS** - 样式框架
- **Zustand** - 状态管理
- **React Router** - 路由管理

## 🚀 快速开始

### 环境要求
- Python 3.9+
- Node.js 16+
- Git

### 后端启动

```bash
cd backend

# 安装依赖
pip install -r requirements.txt

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，填入你的配置
# 特别注意：QQ_EMAIL 和 QQ_EMAIL_AUTH_CODE

# 启动服务
python main.py
```

后端将运行在 http://localhost:8000

### 前端启动

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将运行在 http://localhost:5173 或 http://localhost:5174

## 📦 部署到服务器

### 1. 克隆仓库到服务器

```bash
git clone git@github.com:rain1andsnow2a/yinji-smart-diary.git
cd yinji-smart-diary
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，填入生产环境配置
```

### 3. 使用Docker部署（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

### 4. 手动部署

**后端部署**：
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**前端部署**：
```bash
cd frontend
npm install
npm run build
# 将 dist 目录部署到 Nginx
```

## 🔧 配置说明

### 后端环境变量 (.env)

```env
# 应用配置
APP_NAME=印记
DEBUG=false
ALLOWED_ORIGINS=["https://yourdomain.com"]

# 数据库
DATABASE_URL=sqlite+aiosqlite:///./yinji.db

# JWT密钥（生产环境必须修改）
SECRET_KEY=your-secret-key-here

# SMTP邮箱配置
SMTP_HOST=smtpdm-ap-southeast-1.aliyuncs.com
SMTP_EMAIL=noreply@yingjiapp.com
SMTP_PASSWORD=your-smtp-password

# DeepSeek API
DEEPSEEK_API_KEY=your-api-key
```

### SMTP 配置说明

**阿里云邮件推送（新加坡）**：
1. 登录阿里云控制台
2. 进入 **邮件推送** → **发信地址管理**
3. 查看 SMTP 配置信息
4. 获取 SMTP 密码

## 📝 开发工作流

### 本地开发
```bash
# 修改代码后
git add .
git commit -m "feat: 添加新功能"
git push origin main
```

### 服务器更新
```bash
# SSH到服务器
cd yinji-smart-diary
git pull origin main

# 重启服务
docker-compose restart
# 或手动重启进程
```

## 🔒 安全注意事项

- ⚠️ **不要**将 `.env` 文件提交到Git
- ⚠️ **不要**将数据库文件提交到Git
- ⚠️ 生产环境必须修改 `SECRET_KEY`
- ⚠️ 生产环境建议使用PostgreSQL替代SQLite
- ⚠️ 配置HTTPS和防火墙

## 📄 许可证

MIT License

## 👨‍💻 作者

rain1andsnow2a

## 🤝 贡献

欢迎提交Issue和Pull Request！

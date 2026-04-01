# 快速上传到GitHub并部署

## 🎯 目标
将本地代码上传到GitHub，然后部署到服务器，实现本地开发 → GitHub → 服务器的工作流。

## 📝 步骤一：初始化Git并上传到GitHub

### 1. 初始化本地仓库

```bash
# 进入项目目录
cd d:\bigproject\映记

# 初始化Git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 印记智能日记应用"
```

### 2. 连接到GitHub仓库

```bash
# 添加远程仓库
git remote add origin git@github.com:rain1andsnow2a/yinji-smart-diary.git

# 推送代码
git push -u origin main
```

如果遇到SSH密钥问题：
```bash
# 生成SSH密钥
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# 查看公钥
cat ~/.ssh/id_rsa.pub

# 复制公钥内容，添加到GitHub：
# GitHub → Settings → SSH and GPG keys → New SSH key
```

### 3. 验证上传成功

访问：https://github.com/rain1andsnow2a/yinji-smart-diary

## 🚀 步骤二：部署到服务器

### 方案A：使用云服务器（推荐）

#### 1. 购买云服务器
- **阿里云**：学生机9.5元/月
- **腾讯云**：学生机10元/月
- **配置**：1核2G，Ubuntu 20.04

#### 2. SSH连接到服务器

```bash
ssh root@your-server-ip
```

#### 3. 安装必要软件

```bash
# 更新系统
apt update && apt upgrade -y

# 安装Git
apt install git -y

# 安装Docker（推荐）
curl -fsSL https://get.docker.com | sh

# 或者安装Python和Node.js
apt install python3.9 python3-pip nodejs npm nginx -y
```

#### 4. 克隆项目

```bash
# 配置SSH密钥（同本地步骤）
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
cat ~/.ssh/id_rsa.pub  # 添加到GitHub

# 克隆项目
git clone git@github.com:rain1andsnow2a/yinji-smart-diary.git
cd yinji-smart-diary
```

#### 5. 配置环境变量

```bash
cd backend
cp .env.example .env
nano .env  # 编辑配置
```

**关键配置**：
```env
DEBUG=false
ALLOWED_ORIGINS=["http://your-server-ip"]
SECRET_KEY=生成新密钥
QQ_EMAIL=你的邮箱
QQ_EMAIL_AUTH_CODE=授权码
```

#### 6. 启动服务

**使用Docker（简单）**：
```bash
# 回到项目根目录
cd ..

# 启动
docker-compose up -d

# 查看状态
docker-compose ps
```

**手动启动**：
```bash
# 后端
cd backend
pip3 install -r requirements.txt
nohup python3 main.py > backend.log 2>&1 &

# 前端
cd ../frontend
npm install
npm run build
# 配置Nginx指向dist目录
```

#### 7. 访问应用

浏览器打开：`http://your-server-ip`

### 方案B：使用内网穿透（临时测试）

如果暂时没有服务器，可以使用内网穿透工具：

#### 使用ngrok

```bash
# 下载ngrok
# https://ngrok.com/download

# 启动后端
cd backend
python main.py

# 新终端，启动ngrok
ngrok http 8000

# 会得到一个公网地址，如：https://xxxx.ngrok.io
```

#### 使用frp

```bash
# 下载frp
# https://github.com/fatedier/frp/releases

# 配置frpc.ini
[common]
server_addr = frp服务器地址
server_port = 7000

[web]
type = http
local_port = 8000
custom_domains = your-domain.com
```

## 🔄 日常开发流程

### 本地开发

```bash
# 1. 修改代码
# 2. 测试功能
# 3. 提交到Git
git add .
git commit -m "feat: 添加新功能"
git push origin main
```

### 服务器更新

```bash
# SSH到服务器
ssh root@your-server-ip

# 进入项目目录
cd yinji-smart-diary

# 拉取最新代码
git pull origin main

# 重启服务
docker-compose restart
# 或手动重启进程
```

### 自动化部署（进阶）

创建 `deploy.sh`：
```bash
#!/bin/bash
echo "开始部署..."
git pull origin main
docker-compose down
docker-compose up -d --build
echo "部署完成！"
```

## ✅ 验证部署

### 1. 检查后端

```bash
curl http://your-server-ip:8000/health
# 应返回：{"status":"healthy","database":"connected"}
```

### 2. 检查前端

浏览器访问：`http://your-server-ip`

### 3. 测试功能

- 注册账号
- 发送验证码
- 登录
- 创建日记

## 💡 优势总结

使用这个工作流的好处：

1. ✅ **本地不需要每次启动后端** - 直接连接服务器API
2. ✅ **代码安全备份** - GitHub自动备份
3. ✅ **版本控制** - 可以回滚到任何历史版本
4. ✅ **团队协作** - 未来可以邀请其他开发者
5. ✅ **持续部署** - 本地改代码 → 推送 → 服务器更新

## 🎓 学习资源

- Git教程：https://git-scm.com/book/zh/v2
- Docker教程：https://docs.docker.com/get-started/
- Nginx配置：https://nginx.org/en/docs/

## ⚠️ 注意事项

1. **不要提交敏感信息** - `.env`文件已在`.gitignore`中
2. **定期备份数据库** - 设置自动备份脚本
3. **监控服务器资源** - 防止内存/磁盘不足
4. **配置防火墙** - 只开放必要端口
5. **使用HTTPS** - 生产环境必须配置SSL证书

---

有问题随时问我！🚀

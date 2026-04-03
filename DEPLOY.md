# 部署指南

本文档详细说明如何将"印记"应用部署到云服务器。

## 📋 部署前准备

### 1. 服务器要求
- **操作系统**：Ubuntu 20.04+ / CentOS 7+
- **内存**：至少 2GB RAM
- **存储**：至少 10GB 可用空间
- **网络**：公网IP，开放80/443端口

### 2. 域名配置（可选）
- 购买域名并解析到服务器IP
- 配置DNS A记录

### 3. 本地准备
- 确保代码已提交到GitHub
- 准备好所有环境变量配置

## 🚀 部署步骤

### 方案一：Docker部署（推荐）

#### 1. 安装Docker

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装Docker
curl -fsSL https://get.docker.com | sh

# 安装Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 验证安装
docker --version
docker-compose --version
```

#### 2. 克隆项目

```bash
# 配置Git SSH密钥（如果还没有）
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
cat ~/.ssh/id_rsa.pub  # 复制到GitHub SSH Keys

# 克隆项目
git clone git@github.com:rain1andsnow2a/yinji-smart-diary.git
cd yinji-smart-diary
```

#### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
nano .env  # 或使用 vim
```

**重要配置项**：
```env
DEBUG=false
ALLOWED_ORIGINS=["https://yourdomain.com","http://your-server-ip"]
SECRET_KEY=生成一个新的密钥
SMTP_EMAIL=noreply@yingjiapp.com
SMTP_PASSWORD=你的SMTP密码
DEEPSEEK_API_KEY=你的DeepSeek API密钥
```

#### 4. 创建Docker配置

创建 `docker-compose.yml`：
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
      - ./backend/yinji.db:/app/yinji.db
    env_file:
      - ./backend/.env
    restart: unless-stopped
    command: uvicorn main:app --host 0.0.0.0 --port 8000

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

创建 `backend/Dockerfile`：
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

创建 `frontend/Dockerfile`：
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### 5. 启动服务

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看运行状态
docker-compose ps
```

### 方案二：手动部署

#### 1. 安装依赖

```bash
# 安装Python
sudo apt install python3.9 python3-pip -y

# 安装Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# 安装Nginx
sudo apt install nginx -y
```

#### 2. 部署后端

```bash
cd backend

# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
nano .env

# 使用systemd管理服务
sudo nano /etc/systemd/system/yinji-backend.service
```

**systemd配置**：
```ini
[Unit]
Description=Yinji Backend Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/yinji-smart-diary/backend
Environment="PATH=/path/to/yinji-smart-diary/backend/venv/bin"
ExecStart=/path/to/yinji-smart-diary/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# 启动服务
sudo systemctl daemon-reload
sudo systemctl enable yinji-backend
sudo systemctl start yinji-backend
sudo systemctl status yinji-backend
```

#### 3. 部署前端

```bash
cd frontend

# 安装依赖
npm install

# 构建生产版本
npm run build

# 复制到Nginx目录
sudo cp -r dist/* /var/www/yinji/
```

#### 4. 配置Nginx

```bash
sudo nano /etc/nginx/sites-available/yinji
```

**Nginx配置**：
```nginx
server {
    listen 80;
    server_name yourdomain.com;  # 或服务器IP

    # 前端
    location / {
        root /var/www/yinji;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # 后端API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/yinji /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔒 配置HTTPS（推荐）

```bash
# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 获取SSL证书
sudo certbot --nginx -d yourdomain.com

# 自动续期
sudo certbot renew --dry-run
```

## 🔄 更新部署

### 使用Git自动更新

创建 `update.sh`：
```bash
#!/bin/bash

echo "开始更新..."

# 拉取最新代码
git pull origin main

# 重启服务
if [ -f "docker-compose.yml" ]; then
    docker-compose down
    docker-compose up -d --build
else
    # 更新后端
    cd backend
    source venv/bin/activate
    pip install -r requirements.txt
    sudo systemctl restart yinji-backend
    
    # 更新前端
    cd ../frontend
    npm install
    npm run build
    sudo cp -r dist/* /var/www/yinji/
    sudo systemctl reload nginx
fi

echo "更新完成！"
```

```bash
chmod +x update.sh
./update.sh
```

## 📊 监控和维护

### 查看日志

```bash
# Docker方式
docker-compose logs -f backend
docker-compose logs -f frontend

# systemd方式
sudo journalctl -u yinji-backend -f
sudo tail -f /var/log/nginx/access.log
```

### 数据库备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backup/yinji"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp backend/yinji.db $BACKUP_DIR/yinji_$DATE.db

# 保留最近7天的备份
find $BACKUP_DIR -name "yinji_*.db" -mtime +7 -delete
EOF

chmod +x backup.sh

# 添加到crontab（每天凌晨2点备份）
crontab -e
# 添加：0 2 * * * /path/to/backup.sh
```

## ⚠️ 故障排查

### 后端无法启动
```bash
# 检查日志
docker-compose logs backend
# 或
sudo journalctl -u yinji-backend -n 50

# 检查端口占用
sudo netstat -tlnp | grep 8000
```

### 前端无法访问
```bash
# 检查Nginx状态
sudo systemctl status nginx

# 检查Nginx配置
sudo nginx -t

# 查看错误日志
sudo tail -f /var/log/nginx/error.log
```

### 数据库问题
```bash
# 检查数据库文件权限
ls -la backend/yinji.db

# 重新初始化数据库
cd backend
python -c "from app.db import init_db; import asyncio; asyncio.run(init_db())"
```

## 📞 技术支持

遇到问题？
- 查看项目文档
- 提交GitHub Issue
- 联系开发者

---

祝部署顺利！🎉

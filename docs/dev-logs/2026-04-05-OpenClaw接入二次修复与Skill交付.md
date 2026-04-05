# 2026-04-05 OpenClaw 接入二次修复与 Skill 交付

## 发现的问题

用户反馈 OpenClaw 仍然报 404，并指出我前一次的交付更像“接口底座”，还不是完整的 skill 包。

经排查后发现实际是两类问题叠加：

1. 服务器此前存在端口冲突，导致公网 `/api` 没有稳定命中映记
2. OpenClaw 实际请求到达映记后，请求体格式并不总是标准 JSON
3. `https://yingjiapp.com` 当前并未指向映记，易引发误判

## 本次修复

### 服务端

- 将映记后端切换到 `8001`
- 将 `yingjiapp.com` 的 nginx 代理改为转发到 `8001`
- 保留其他旧项目继续使用 `8000`

### 接口兼容性

对 `/api/v1/integrations/openclaw/ingest` 做兼容增强：

- 标准 JSON
- 纯文本 body
- 表单 body
- query 参数 fallback

这样可以适配更多外部代理平台。

### 前端文案

将“已接入”改为“已生成令牌”，避免用户误以为已经和 OpenClaw 双向绑定完成。

## 新增交付物

新增完整 OpenClaw skill 包目录：

- `docs/integrations/openclaw-skill/`

包含：

- `skill.md`
- `http-action.json`
- `examples.md`
- `test_ingest.py`

同时新增：

- `OpenClaw手机接入图文说明.md`

## 当前结论

- `http://yingjiapp.com/api/v1/integrations/openclaw/ingest` 已可用
- `https://yingjiapp.com/...` 目前仍不建议使用
- 服务器日志已确认外部写入成功

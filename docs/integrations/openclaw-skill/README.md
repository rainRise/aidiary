# OpenClaw Skill Bundle for 映记

这是一个可直接交给 OpenClaw / 小龙虾侧使用的接入包示例。

## 包含内容

- `skill.md`
  OpenClaw 的技能说明与行为约束
- `http-action.json`
  推荐的 HTTP 动作配置示例
- `examples.md`
  若平台不支持结构化动作，可直接复制的提示词版本
- `test_ingest.py`
  本地联调脚本，用来快速验证映记接口是否可达

## 推荐使用方式

1. 先在映记设置页生成专属令牌
2. 把令牌填入 `http-action.json`
3. 将 `skill.md` 导入 OpenClaw 的技能系统
4. 先用 `test_ingest.py` 做一次联调

## 注意

当前推荐使用：

- `http://yingjiapp.com/api/v1/integrations/openclaw/ingest`

因为当前 `https://yingjiapp.com` 尚未配置到映记对应站点。  
如果 OpenClaw 平台强制 HTTPS，需要等映记域名证书配置完成后再切换。

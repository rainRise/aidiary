# OpenClaw 接入映记

## 这是什么

这一功能让用户把自己的映记账号接入 OpenClaw 小龙虾。  
接入后，用户在手机上对小龙虾说：

- 今天想记一下……
- 帮我把这段话存成今天的日记
- 把刚刚那段追加到我今天的日记里

小龙虾就可以通过映记提供的外部写入接口，把内容写进该用户自己的日记系统。

> **开源仓库**：OpenClaw 技能包已独立开源，可直接获取：  
> [github.com/rain1andsnow2a/yinji-openclaw-skill](https://github.com/rain1andsnow2a/yinji-openclaw-skill)

## 实现原理

这次实现的不是"绑死 OpenClaw 的私有适配"，而是一层通用的外部速记接入能力：

1. 用户在映记里生成一枚 **外部接入令牌**
2. 令牌只展示一次，数据库里只保存 **SHA-256 哈希**
3. OpenClaw 拿着这枚令牌，请求映记后端接口
4. 后端根据令牌找到对应用户，并检查令牌是否过期
5. 后端以该用户身份创建日记，或追加到当天最新一篇日记

这样做的好处是：

- 不暴露用户登录态
- 不复用网页 Cookie
- 令牌支持过期机制（`expires_at` 为空表示永久有效）
- 后续也能接快捷指令、飞书机器人、自动化工作流

## 后端接口

### 1. 查看接入状态

- `GET /api/v1/integrations/openclaw/status`
- 返回当前令牌的连接状态、过期时间、最近使用时间、ingest URL

### 2. 生成 / 重置令牌

接口：

- `POST /api/v1/integrations/openclaw/token`
- RESTful 别名：`POST /api/v1/integrations/openclaw-tokens`

逻辑：

- 生成随机 token，格式 `yji_oc_xxx`
- 使用 `SHA-256` 计算哈希
- 数据库保存 `token_hash`，令牌默认**永久有效**
- 返回明文 token 给前端，仅此一次

### 3. 关闭接入

- `DELETE /api/v1/integrations/openclaw/token`
- RESTful 别名：`DELETE /api/v1/integrations/openclaw-tokens`

### 4. 外部请求写入日记

接口：

- `POST /api/v1/integrations/openclaw/ingest`
- RESTful 别名：`POST /api/v1/integrations/openclaw-entries`

认证方式：

- `Authorization: Bearer <token>`
- 或 `X-Yinji-Integration-Token: <token>`

请求体（完整字段）：

```json
{
  "content": "今天在图书馆做完了系统部署，心里很踏实。",
  "title": "今天的推进",
  "diary_date": "2026-04-05",
  "emotion_tags": ["开心", "成就感"],
  "importance_score": 8,
  "images": [],
  "mode": "create"
}
```

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | 是 | — | 正文（1~10000 字） |
| `title` | 否 | 自动从正文前 24 字截取 | 可选标题 |
| `diary_date` | 否 | 当天 | 日记日期（YYYY-MM-DD） |
| `emotion_tags` | 否 | 无 | 情绪标签列表 |
| `importance_score` | 否 | 5 | 重要性（1~10） |
| `images` | 否 | 无 | 图片地址列表 |
| `mode` | 否 | `create` | `create`=新建日记，`append_today`=追加到今天已有日记 |

> **注意**：`mode` 默认值为 `create`（新建日记），而非追加。如果希望追加到今天已有日记，需显式传 `"mode": "append_today"`。

服务端逻辑：

1. 对传入 token 做 SHA-256
2. 到 `external_integration_tokens` 查匹配项
3. 校验令牌有效性（是否激活、是否过期）
4. 找到对应用户
5. 根据 `mode` 执行：
   - `create`：新建一篇日记（自动推断标题）
   - `append_today`：若当天已有日记则追加正文、合并情绪标签和图片；无则新建
6. 更新令牌的 `last_used_at`
7. 返回本次写入结果（`action: "created"` 或 `"appended"`）

#### 多种请求格式兼容

后端同时兼容以下格式，方便不同平台对接：

1. **JSON**（`Content-Type: application/json`）
2. **纯文本**（`Content-Type: text/plain`）— 整段正文作为 content
3. **表单**（`Content-Type: application/x-www-form-urlencoded`）
4. **Query 参数兜底**（`?content=xxx&mode=create`）

## 数据表

表名：`external_integration_tokens`

| 字段 | 说明 |
|------|------|
| `user_id` | 关联用户 |
| `provider` | 服务提供者（固定 `"openclaw"`） |
| `token_hash` | SHA-256 哈希 |
| `token_hint` | 脱敏展示（如 `yji_oc_x...abcd`） |
| `is_active` | 是否激活 |
| `expires_at` | 过期时间（NULL 表示永久有效） |
| `created_at` | 创建时间 |
| `last_used_at` | 最近使用时间 |

## 前端入口

入口放在：

- `个人设置 -> OpenClaw 小龙虾速记接入`

用户可进行：

- 生成 / 重置接入令牌
- 复制令牌
- 复制接入 URL
- 查看最近使用时间、过期时间
- 关闭接入

## OpenClaw 技能提示词

技能提示词已开源在 [yinji-openclaw-skill](https://github.com/rain1andsnow2a/yinji-openclaw-skill) 仓库中。

核心提示词（`skill.md`）的行为规则：

1. 不要擅自扩写用户原文
2. 除非用户明确要求，不自动加标题
3. 如果用户说了标题、日期、情绪或重要性，一并携带到请求体
4. 如果用户明确说"单独存一篇 / 新开一篇"，使用 `mode: "create"`
5. 如果无法确定是否要新建，默认 `mode: "create"`
6. 接口成功则告知用户"已经帮你记进映记了"
7. 接口失败则把错误原文告诉用户

示例 HTTP 动作配置（`http-action.json`）：

```json
{
  "name": "映记日记速记",
  "method": "POST",
  "url": "http://yingjiapp.com/api/v1/integrations/openclaw/ingest",
  "headers": {
    "Authorization": "Bearer {{YINJI_TOKEN}}",
    "Content-Type": "application/json"
  },
  "body": {
    "content": "{{USER_INPUT}}",
    "title": "{{USER_TITLE}}",
    "diary_date": "{{USER_DIARY_DATE_YYYY_MM_DD}}",
    "emotion_tags": ["{{USER_EMOTION_TAG_1}}"],
    "importance_score": 5,
    "mode": "append_today"
  }
}
```

## 为什么这套方案适合当前项目

因为映记本质是"个人心理与成长记录系统"，而 OpenClaw 更像是"用户随身入口"。  
两者组合后，映记获得了一个自然语言写入通道：

- 手机端更轻
- 记录门槛更低
- 日记采集更高频
- 后续还能接入 AI 总结、成长分析、RAG 检索

## 当前边界

映记这边已经准备好了完整的接口、令牌体系和技能包。  
OpenClaw 技能包已作为独立开源仓库发布：

- 仓库地址：[github.com/rain1andsnow2a/yinji-openclaw-skill](https://github.com/rain1andsnow2a/yinji-openclaw-skill)
- 包含：`skill.md`（技能提示词）、`http-action.json`（HTTP 动作配置）、`examples.md`（提示词版本）、`test_ingest.py`（联调脚本）

如果后续要继续做，可以升级为：

1. 支持"语音转日记草稿"
2. 支持"先发到收件箱，晚点整理成正式日记"

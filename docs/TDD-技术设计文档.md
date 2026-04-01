# 印记 - 技术设计文档 (TDD)

## 1. 技术架构概览

### 1.1 技术栈选型

| 层级 | 技术选型 | 理由 |
|------|---------|------|
| **前端** | React + Tailwind CSS | 生态丰富，快速开发UI |
| **移动端** | React Native | 跨平台，代码复用率高 |
| **后端框架** | FastAPI (Python) | 原生异步，支持流式输出 |
| **AI编排** | LangGraph | 有状态Agent，完美匹配需求 |
| **LLM** | DeepSeek V3 | 成本极低（¥1/百万tokens），推理能力强 |
| **向量数据库** | Milvus | 多租户隔离，混合检索 |
| **图数据库** | Neo4j | GraphRAG标准，关系查询强大 |
| **关系数据库** | PostgreSQL 16 | JSON支持好，全文检索强，开源免费 |
| **缓存** | Redis | 高性能，支持多种数据结构 |
| **消息队列** | RabbitMQ | 异步任务处理 |
| **容器化** | Docker + K8s | 微服务部署，弹性伸缩 |
| **对象存储** | 阿里云OSS / AWS S3 | 图片/视频存储 |

---

## 2. 数据库设计

### 2.1 PostgreSQL 关系数据库

**选择理由**：
- ✅ **JSONB支持**：原生JSON类型，比MySQL的JSON性能更好
- ✅ **全文检索**：内置强大的全文检索（支持中文分词）
- ✅ **开源免费**：无商业授权风险
- ✅ **扩展性强**：支持向量扩展（pgvector），可与Milvus互补
- ✅ **事务强**：MVCC机制，并发性能好

#### 2.1.1 用户表 (users)
```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    is_premium BOOLEAN DEFAULT FALSE,
    premium_expires_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 自动更新 updated_at 触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.1.2 用户画像表 (user_profiles)
```sql
CREATE TABLE user_profiles (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_tag VARCHAR(50),  -- 创业者/职场精英/文艺青年等
    current_state VARCHAR(50),  -- 迷茫/压力大/记录美好等
    personality_type VARCHAR(20),  -- MBTI类型
    social_style VARCHAR(50),  -- 朋友圈风格
    catchphrases JSONB,  -- 口头禅列表（使用JSONB性能更好）
    preferences JSONB,  -- 偏好数据
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.1.3 日记表 (diaries)
```sql
CREATE TABLE diaries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    content TEXT NOT NULL,
    content_html TEXT,  -- 富文本HTML
    diary_date DATE NOT NULL,
    emotion_tags JSONB,  -- 情绪标签数组
    importance_score SMALLINT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
    word_count INT DEFAULT 0,
    images JSONB,  -- 图片URL数组
    is_analyzed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- 全文检索向量列（自动生成）
    content_tsv TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('chinese', coalesce(title, '') || ' ' || content)
    ) STORED
);

CREATE INDEX idx_diaries_user_date ON diaries(user_id, diary_date);
CREATE INDEX idx_diaries_user_created ON diaries(user_id, created_at);
CREATE INDEX idx_diaries_content_tsv ON diaries USING GIN(content_tsv);  -- 全文检索索引

CREATE TRIGGER update_diaries_updated_at BEFORE UPDATE ON diaries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.1.4 时间轴表 (timeline_events)
```sql
CREATE TABLE timeline_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diary_id BIGINT REFERENCES diaries(id) ON DELETE SET NULL,
    event_date DATE NOT NULL,
    event_summary VARCHAR(500) NOT NULL,
    emotion_tag VARCHAR(50),
    importance_score SMALLINT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
    event_type VARCHAR(50),  -- work/relationship/health/achievement等
    related_entities JSONB,  -- 相关实体（人物/地点）
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeline_user_date ON timeline_events(user_id, event_date DESC);
CREATE INDEX idx_timeline_emotion ON timeline_events(user_id, emotion_tag);
CREATE INDEX idx_timeline_entities ON timeline_events USING GIN(related_entities);  -- JSONB索引
```

#### 2.1.5 AI分析记录表 (ai_analyses)
```sql
CREATE TABLE ai_analyses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diary_id BIGINT NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50),  -- satir/emotion/summary等
    behavior_layer JSONB,  -- 行为层分析
    emotion_layer JSONB,  -- 情绪层分析
    cognitive_layer JSONB,  -- 思维层分析
    belief_layer JSONB,  -- 信念层分析
    core_self_layer JSONB,  -- 存在层分析
    response_text TEXT,  -- AI回复文本
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_analyses_user_diary ON ai_analyses(user_id, diary_id);
CREATE INDEX idx_ai_analyses_type ON ai_analyses(analysis_type);
```

#### 2.1.6 朋友圈文案表 (social_posts)
```sql
CREATE TABLE social_posts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    diary_id BIGINT REFERENCES diaries(id) ON DELETE SET NULL,
    generated_content TEXT NOT NULL,
    final_content TEXT,  -- 用户修改后的内容
    style_tag VARCHAR(50),  -- 风格标签
    is_used BOOLEAN DEFAULT FALSE,
    user_modifications JSONB,  -- 用户修改记录（用于学习）
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_social_posts_user_created ON social_posts(user_id, created_at);
```

### 2.2 Milvus 向量数据库

#### 2.2.1 Collection设计

```python
# 日记向量Collection
diary_collection_schema = {
    "collection_name": "diary_embeddings",
    "fields": [
        {"name": "id", "type": "INT64", "is_primary": True, "auto_id": True},
        {"name": "user_id", "type": "INT64"},  # Partition Key
        {"name": "diary_id", "type": "INT64"},
        {"name": "diary_date", "type": "VARCHAR", "max_length": 20},
        {"name": "embedding", "type": "FLOAT_VECTOR", "dim": 1536},  # OpenAI ada-002
        {"name": "content_snippet", "type": "VARCHAR", "max_length": 500},
        {"name": "emotion_tags", "type": "VARCHAR", "max_length": 200},
        {"name": "importance_score", "type": "INT8"},
    ],
    "partition_key_field": "user_id",  # 多租户隔离
}

# 索引配置
index_params = {
    "metric_type": "COSINE",  # 余弦相似度
    "index_type": "HNSW",  # 高性能近似搜索
    "params": {"M": 16, "efConstruction": 200}
}
```

#### 2.2.2 检索策略

```python
# 混合检索示例
search_params = {
    "metric_type": "COSINE",
    "params": {"ef": 100},
    "filter": f"user_id == {user_id} and diary_date >= '2026-01-01' and importance_score >= 7"
}
```

### 2.3 Neo4j 图数据库

#### 2.3.1 节点类型 (Node Labels)

```cypher
// 用户节点
CREATE (u:User {
    user_id: 123,
    username: "张三",
    created_at: datetime()
})

// 人物节点
CREATE (p:Person {
    name: "老王",
    first_mentioned: date(),
    mention_count: 15
})

// 事件节点
CREATE (e:Event {
    event_id: 456,
    summary: "项目上线",
    date: date(),
    emotion: "兴奋"
})

// 情绪节点
CREATE (em:Emotion {
    type: "焦虑",
    intensity: 8
})

// 地点节点
CREATE (l:Location {
    name: "公司",
    type: "workplace"
})
```

#### 2.3.2 关系类型 (Relationships)

```cypher
// 人际关系
(User)-[:KNOWS]->(Person)
(Person)-[:IS_BOSS_OF]->(User)
(Person)-[:COLLEAGUE_OF]->(Person)

// 事件关系
(User)-[:EXPERIENCED]->(Event)
(Event)-[:CAUSED_BY]->(Person)
(Event)-[:HAPPENED_AT]->(Location)
(Event)-[:TRIGGERED]->(Emotion)

// 因果关系
(Event)-[:LEADS_TO]->(Event)
(Emotion)-[:CAUSED_BY]->(Event)

// 时间关系
(Event)-[:BEFORE]->(Event)
(Event)-[:AFTER]->(Event)
```

#### 2.3.3 查询示例

```cypher
// 查询压力源分析
MATCH (u:User {user_id: 123})-[:EXPERIENCED]->(e:Event)-[:TRIGGERED]->(em:Emotion {type: "压力"})
MATCH (e)-[:CAUSED_BY]->(p:Person)
RETURN p.name, COUNT(e) as stress_count
ORDER BY stress_count DESC
LIMIT 5

// 查询事件链
MATCH path = (e1:Event)-[:LEADS_TO*1..3]->(e2:Event)
WHERE e1.date >= date('2026-01-01')
RETURN path
```

---

## 3. AI Agent 设计（LangGraph）

### 3.1 整体状态机设计

```python
from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Dict

# 定义全局状态
class AnalysisState(TypedDict):
    user_id: int
    diary_id: int
    diary_content: str
    user_profile: Dict
    timeline_context: List[Dict]
    
    # 萨提亚冰山五层
    behavior_layer: Dict
    emotion_layer: Dict
    cognitive_layer: Dict
    belief_layer: Dict
    core_self_layer: Dict
    
    # 输出
    therapeutic_response: str
    social_post: str
    
    # 元数据
    processing_time: float
    error: str
```

### 3.2 Agent 0: 上下文收集器 (Context Collector)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent 0: 上下文收集器 (Context Collector)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【职责】
收集心理分析所需的所有上下文信息，为后续Agent提供完整的输入数据

【输入契约】
{
  "userId": int,
  "diaryId": int,
  "diaryContent": str
}

【核心逻辑】
1. 获取用户画像
   - 数据源: PostgreSQL - user_profiles 表
   - 提取: identityTag, currentState, personalityType, socialStyle, catchphrases

2. 获取时间轴上下文
   - 数据源: PostgreSQL - timeline_events 表
   - 查询: 最近7天的事件记录
   - 排序: 按日期倒序

3. 检索相关历史记忆（可选）
   - 数据源: Milvus 向量数据库
   - 策略: 将当前日记向量化，检索Top 3相似历史日记
   - 目的: 发现重复模式

4. 获取知识图谱关系（可选）
   - 数据源: Neo4j 图数据库
   - 查询: 相关人物、压力源统计
   - 示例: 查询"老板"触发压力的次数

【输出契约】
{
  "userId": int,
  "diaryId": int,
  "diaryContent": str,
  "diaryDate": date,
  "userProfile": {
    "identityTag": str,
    "currentState": str,
    "personalityType": str,
    "socialStyle": str,
    "catchphrases": List[str]
  },
  "timelineContext": List[Dict] (最近7天事件),
  "relatedMemories": List[Dict] (可选),
  "graphContext": Dict (可选)
}

【性能约束】
- 处理时间: < 0.5秒
- 数据库查询: 4次读取（PostgreSQL x2, Milvus x1, Neo4j x1）

【错误处理】
- 用户画像缺失: 使用默认画像（INFP, 通用状态）
- 时间轴为空: 返回空数组，不影响后续流程
- 向量检索失败: 跳过相关记忆，继续流程
- 图谱查询失败: 跳过图谱上下文，继续流程

【依赖服务】
- PostgreSQL（用户画像、时间轴）
- Milvus（向量检索）
- Neo4j（知识图谱）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.3 Agent A: 时间线管家 (Timeline Manager)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent A: 时间线管家 (Timeline Manager)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【职责】
从日记中提取关键事件，构建结构化时间轴，检测连续事件模式

【输入契约】
{
  "user_id": int,
  "diary_id": int,
  "diary_content": str (min: 10字),
  "diary_date": date
}

【核心逻辑】
1. 事件提取
   - 识别关键事件（Who/What/Where/When）
   - 提取情绪标签（焦虑/开心/愤怒等）
   - 评估重要性（1-10分）
   - 分类事件类型（work/relationship/health/achievement）
   - 提取相关实体（人物/地点）

2. 时间轴更新
   - 将事件存入PostgreSQL时间轴表
   - 关联到用户和日记ID

3. 模式检测
   - 检测连续事件（如：连续3天失眠）
   - 识别周期性模式（如：每周一焦虑）
   - 标记异常事件（重要性 > 8）

4. 上下文构建
   - 获取最近7天的事件摘要
   - 为后续分析提供历史背景

【输出契约】
{
  "timeline_context": List[Dict] (最近7天事件),
  "current_event": {
    "summary": str (一句话摘要),
    "emotion_tag": str,
    "importance_score": int (1-10),
    "event_type": str (enum: work/relationship/health/achievement),
    "entities": {
      "persons": List[str],
      "locations": List[str]
    }
  },
  "detected_patterns": List[Dict] (可选)
}

【性能约束】
- 处理时间: < 2秒
- LLM Token消耗: < 500

【数据持久化】
- 目标表: timeline_events (PostgreSQL)
- 字段映射:
  - event_summary ← current_event.summary
  - emotion_tag ← current_event.emotion_tag
  - importance_score ← current_event.importance_score

【错误处理】
- 日记过短: 返回空事件，不阻断流程
- 实体提取失败: 使用空列表
- 数据库写入失败: 记录日志，不影响后续节点
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.3 Agent B: 萨提亚分析师 (Satir Therapist)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent B: 萨提亚分析师 (Satir Therapist)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【职责】
基于萨提亚冰山模型，对用户日记进行五层深度分析，生成温暖的疗愈回复

【输入契约】
{
  "user_id": int,
  "diary_content": str (min: 10字, max: 10000字),
  "user_profile": {
    "personality_type": str (MBTI类型, 可选),
    "current_state": str
  },
  "timeline_context": List[Dict] (最近7天事件)
}

【核心逻辑】
采用五个子节点顺序处理，逐层深入：

┌─────────────────────────────────────────┐
│ Node B1: 情绪侦探 (Emotion Agent)       │
├─────────────────────────────────────────┤
│ 输入: diary_content                     │
│ 任务:                                   │
│   1. 提取显性事件 (Who/What/Where/When) │
│   2. 识别应对姿态 (指责/讨好/超理智/打岔)│
│   3. 分析表层情绪 (愤怒/焦虑/开心)      │
│   4. 挖掘潜在情绪 (恐惧/委屈/渴望)      │
│ 输出:                                   │
│   - behavior_layer: {                   │
│       event: str,                       │
│       coping_style: str (enum)          │
│     }                                   │
│   - emotion_layer: {                    │
│       surface: str,                     │
│       underlying: str                   │
│     }                                   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Node B2: 信念挖掘机 (Cognitive Agent)   │
├─────────────────────────────────────────┤
│ 输入: diary_content + emotion_layer     │
│ 任务:                                   │
│   1. 识别非理性信念 ("我必须完美")     │
│   2. 发现未满足期待 ("希望被认可")     │
│   3. 提取核心价值观 ("成就感很重要")   │
│ 输出:                                   │
│   - cognitive_layer: {                  │
│       thinking: str (非理性信念)        │
│     }                                   │
│   - belief_layer: {                     │
│       belief: str (核心价值观)          │
│     }                                   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Node B3: 灵魂摆渡人 (Existence Agent)   │
├─────────────────────────────────────────┤
│ 输入: 前面所有层 + timeline_context     │
│ 任务:                                   │
│   洞察深层渴望:                         │
│   - 被爱 (Love)                         │
│   - 被接纳 (Acceptance)                 │
│   - 自由 (Freedom)                      │
│   - 意义 (Meaning)                      │
│ 输出:                                   │
│   - core_self_layer: {                  │
│       desire: str (100-200字),          │
│       life_energy: str                  │
│     }                                   │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│ Node B4: 疗愈回信生成器 (Responder)     │
├─────────────────────────────────────────┤
│ 输入: core_self_layer + user_profile    │
│ 任务:                                   │
│   根据用户性格类型调整语气:             │
│   - INFP: 温柔共情，诗意表达            │
│   - INTJ: 理性分析，提供框架            │
│   - ESFP: 积极鼓励，活泼轻松            │
│   生成内容包含:                         │
│   1. 看见感受                           │
│   2. 连接渴望                           │
│   3. 成长建议                           │
│ 输出:                                   │
│   - therapeutic_response: str (200-300字)│
└─────────────────────────────────────────┘
```

【输出契约】
{
  "behavior_layer": {
    "event": str,
    "coping_style": str (enum: 指责/讨好/超理智/打岔)
  },
  "emotion_layer": {
    "surface": str,
    "underlying": str
  },
  "cognitive_layer": {
    "thinking": str
  },
  "belief_layer": {
    "belief": str
  },
  "core_self_layer": {
    "desire": str,
    "life_energy": str
  },
  "therapeutic_response": str (200-300字)
}

【性能约束】
- 总处理时间: < 5秒
- LLM调用次数: ≤ 4次 (每个子节点1次)
- Token消耗: < 3000

【错误处理】
- 日记过短 (<10字): 返回引导式提问
- LLM超时: 降级为简化版3层分析
- 用户画像缺失: 使用默认通用人设 (INFP)

【依赖服务】
- LLM服务 (OpenAI GPT-4)
- 向量数据库 (Milvus，检索历史记忆)
- 时间轴服务 (获取上下文)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.4 Agent C: 社交主编 (Social Content Creator)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent C: 社交主编 (Social Content Creator)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【职责】
生成个性化朋友圈文案，学习用户修改记录，持续优化风格匹配度

【输入契约】
{
  "user_id": int,
  "diary_content": str,
  "user_profile": {
    "social_style": str (文艺极简风/职场干货风/幽默自嘲风等),
    "catchphrases": List[str] (用户口头禅)
  }
}

【核心逻辑】
1. 风格匹配
   - 读取用户的社交风格偏好
   - 提取用户的口头禅列表
   - 获取历史修改记录（用于风格学习）

2. 文案生成
   - 生成3个不同版本的文案
   - 版本A: 简洁版 (50-80字)
   - 版本B: 情感版 (80-100字)
   - 版本C: 幽默版 (60-90字)

3. 风格融合
   - 自然融入用户口头禅
   - 符合用户社交人设
   - 避免过度煽情或刻意

4. 学习机制
   - 记录用户选择的版本
   - 分析用户的修改内容
   - 更新Style Profile

【输出契约】
{
  "social_posts": [
    {
      "version": "A",
      "content": str (50-80字),
      "style": "简洁版"
    },
    {
      "version": "B",
      "content": str (80-100字),
      "style": "情感版"
    },
    {
      "version": "C",
      "content": str (60-90字),
      "style": "幽默版"
    }
  ]
}

【性能约束】
- 处理时间: < 2秒
- LLM Token消耗: < 800

【风格学习流程】
用户修改文案 → 记录修改差异 → 提取风格特征 → 更新用户画像

示例:
原文: "今天很开心"
修改: "今日份的小确幸"
学习: 用户偏好文艺表达，喜欢"今日份"句式

【数据持久化】
- 目标表: social_posts (PostgreSQL)
- 学习数据: user_profiles.catchphrases (JSONB字段)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.5 Agent D: 知识图谱构建器 (Graph Builder)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Agent D: 知识图谱构建器 (Graph Builder)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【职责】
从日记中提取实体和关系，构建个人知识图谱，支持深度关系分析

【输入契约】
{
  "user_id": int,
  "diary_content": str,
  "current_event": Dict (来自时间线管家)
}

【核心逻辑】
1. 实体提取 (Entity Extraction)
   类型:
   - Person (人物): 姓名、关系类型
   - Location (地点): 名称、类型 (workplace/home/public)
   - Event (事件): 摘要、日期、情绪
   - Emotion (情绪): 类型、强度 (1-10)

2. 关系提取 (Relation Extraction)
   人际关系:
   - KNOWS (认识)
   - IS_BOSS_OF (上下级)
   - COLLEAGUE_OF (同事)
   - FAMILY_OF (家人)
   
   事件关系:
   - EXPERIENCED (经历)
   - CAUSED_BY (由...引起)
   - HAPPENED_AT (发生在)
   - TRIGGERED (触发)
   
   因果关系:
   - LEADS_TO (导致)
   - BEFORE/AFTER (时间顺序)

3. 图谱更新
   - 创建新节点 (如果不存在)
   - 建立关系边
   - 更新节点属性 (如: mention_count++)

4. 关系推理
   示例:
   IF 日记提到 "老王又批评我了"
   THEN 推理:
     - 老王 IS_BOSS_OF 用户
     - 批评事件 TRIGGERED 压力情绪
     - 压力 CAUSED_BY 老王

【输出契约】
{
  "entities": [
    {
      "type": str (Person/Location/Event/Emotion),
      "name": str,
      "properties": Dict
    }
  ],
  "relations": [
    {
      "from": str (实体名称),
      "to": str (实体名称),
      "type": str (关系类型),
      "properties": Dict (可选)
    }
  ]
}

【性能约束】
- 处理时间: < 2秒
- Neo4j写入: 批量操作，单次 < 100个节点

【图谱查询能力】
支持的分析查询:
1. 压力源分析
   MATCH (u:User)-[:EXPERIENCED]->(e:Event)-[:TRIGGERED]->(em:Emotion {type: "压力"})
   MATCH (e)-[:CAUSED_BY]->(p:Person)
   RETURN p.name, COUNT(e) as stress_count

2. 事件链分析
   MATCH path = (e1:Event)-[:LEADS_TO*1..3]->(e2:Event)
   RETURN path

3. 人际关系网络
   MATCH (u:User)-[:KNOWS]->(p:Person)
   RETURN p, p.mention_count

【错误处理】
- 实体提取失败: 返回空列表，不阻断流程
- Neo4j连接失败: 记录日志，降级为仅存PostgreSQL
- 关系冲突: 保留最新关系，更新时间戳
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.6 LangGraph 编排流程

```
工作流定义 (Workflow Definition)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

节点执行顺序:

  START
    ↓
┌──────────────────────┐
│ Agent 0:             │ ← 收集上下文（用户画像、时间轴）
│ Context Collector    │
└──────────────────────┘
    ↓
┌──────────────────────┐
│ Agent 1:             │ ← 提取事件，更新时间轴
│ Timeline Manager     │
└──────────────────────┘
    ↓
┌──────────────────────┐
│ Agent 2:             │ ← 萨提亚五层分析
│ Satir Therapist      │
│  ├─ Node 2.1: 情绪侦探│
│  ├─ Node 2.2: 信念挖掘│
│  ├─ Node 2.3: 灵魂摆渡│
│  └─ Node 2.4: 疗愈回信│
└──────────────────────┘
    ↓
┌──────────────────────┐
│ Agent 3:             │ ← 更新知识图谱
│ Graph Builder        │
└──────────────────────┘
    ↓
   END

状态传递:
每个节点接收 AnalysisState，处理后返回更新的 State

并发优化:
- Agent 0 和 Agent 1 可并行执行（如果时间轴已有数据）
- Agent 3 可独立于用户响应（后台更新图谱）

错误恢复:
- Agent 0 失败: 使用默认画像 + 空时间轴
- Agent 1 失败: 跳过时间轴更新
- Agent 2 失败: 降级为简化版3层分析
- Agent 3 失败: 记录日志，不影响用户体验

性能指标:
- 总耗时: ~5.6秒
- LLM调用: 6次
- 数据库操作: ~10次

详细工作流请参考: 《多Agent心理分析工作流.md》
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 4. API 架构设计

### 4.1 API 设计原则

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API 设计原则
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【命名规范】
- RESTful风格
- 小驼峰命名（camelCase）
- 资源名词复数形式

【认证机制】
- JWT Token认证
- Bearer Token方式
- Token过期时间: 7天

【错误追踪】
- 每个请求携带 traceId
- 格式: UUID v4
- 用于日志关联和错误排查

【响应格式】
统一响应结构:
{
  "traceId": "uuid",
  "success": boolean,
  "data": object | array,
  "error": {
    "code": string,
    "message": string
  },
  "timestamp": ISO8601
}

【版本控制】
- URL路径版本: /v1/
- 向后兼容原则
- 废弃API提前通知（3个月）

【限流策略】
- 免费用户: 100 req/min
- 高级用户: 1000 req/min
- 使用 X-RateLimit-* 响应头
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.2 API 模块划分

```
模块结构:

/v1
├── /auth                    # 认证模块
│   ├── POST /register       # 用户注册
│   ├── POST /login          # 用户登录
│   └── POST /refresh        # 刷新Token
│
├── /users                   # 用户模块
│   ├── GET /{userId}/profile
│   ├── PUT /{userId}/profile
│   └── DELETE /{userId}
│
├── /diaries                 # 日记模块
│   ├── POST /               # 创建日记
│   ├── GET /                # 列表查询
│   ├── GET /{diaryId}       # 详情查询
│   ├── PUT /{diaryId}       # 更新日记
│   └── DELETE /{diaryId}    # 删除日记
│
├── /ai                      # AI分析模块
│   ├── POST /analyze        # 触发分析（异步）
│   ├── GET /analyze/{taskId} # 查询结果
│   └── GET /analyses        # 历史记录
│
├── /social                  # 社交文案模块
│   ├── POST /generate       # 生成文案
│   └── POST /{postId}/feedback # 反馈学习
│
├── /insights                # 数据洞察模块
│   ├── GET /emotionTrend    # 情绪趋势
│   ├── GET /timeline        # 时间轴
│   ├── GET /stressSources   # 压力源分析
│   ├── POST /weeklySummary  # 周总结
│   └── POST /monthlyReport  # 月度报告
│
└── /ws                      # WebSocket
    └── /analyze             # 实时流式分析
```

**详细接口定义请参考：`API接口文档.md`**

### 4.3 traceId 追踪机制

```
请求流程:
┌─────────────────────────────────────────────────────┐
│ 1. 客户端生成 traceId (UUID v4)                     │
│    或由网关自动生成                                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. 请求头携带                                        │
│    X-Trace-Id: 550e8400-e29b-41d4-a716-446655440000 │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. 所有服务层传递 traceId                           │
│    - FastAPI → LangGraph → LLM                      │
│    - 数据库操作日志                                  │
│    - 外部API调用                                     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. 响应返回 traceId                                  │
│    {                                                 │
│      "traceId": "550e8400...",                       │
│      "data": {...}                                   │
│    }                                                 │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. 日志聚合（ELK/Loki）                             │
│    - 按 traceId 关联所有日志                         │
│    - 快速定位问题链路                                │
└─────────────────────────────────────────────────────┘

日志示例:
[2026-02-05 15:30:00] INFO [traceId=550e8400...] API Gateway: POST /v1/ai/analyze
[2026-02-05 15:30:01] INFO [traceId=550e8400...] AI Service: Start analysis
[2026-02-05 15:30:02] INFO [traceId=550e8400...] LLM: GPT-4 invoked
[2026-02-05 15:30:05] INFO [traceId=550e8400...] AI Service: Analysis completed
[2026-02-05 15:30:05] INFO [traceId=550e8400...] API Gateway: Response 200
```

---

## 5. 前端技术方案

### 5.1 技术栈

```json
{
    "framework": "React 18",
    "state_management": "Zustand",
    "routing": "React Router v6",
    "ui_library": "shadcn/ui + Tailwind CSS",
    "charts": "Recharts",
    "editor": "Lexical (Meta开源富文本编辑器)",
    "icons": "Lucide React",
    "http_client": "Axios",
    "websocket": "Socket.IO Client",
    "build_tool": "Vite"
}
```

### 5.2 核心页面结构

```
src/
├── pages/
│   ├── Home.tsx                 # 首页（日记列表）
│   ├── DiaryEditor.tsx          # 日记编辑器
│   ├── AIAnalysis.tsx           # AI分析页面
│   ├── SocialPost.tsx           # 朋友圈文案生成
│   ├── Insights/
│   │   ├── Dashboard.tsx        # 数据看板
│   │   ├── Timeline.tsx         # 时间轴
│   │   ├── EmotionTrend.tsx     # 情绪趋势
│   │   └── KnowledgeGraph.tsx   # 知识图谱可视化
│   ├── Profile.tsx              # 用户画像设置
│   └── Onboarding.tsx           # 首次使用引导
├── components/
│   ├── IcebergChart.tsx         # 萨提亚冰山图
│   ├── EmotionCalendar.tsx      # 心情日历
│   ├── StyleSelector.tsx        # 风格选择器
│   └── ...
├── hooks/
│   ├── useAIAnalysis.ts         # AI分析Hook
│   ├── useDiary.ts              # 日记CRUD Hook
│   └── useWebSocket.ts          # WebSocket Hook
├── store/
│   ├── userStore.ts             # 用户状态
│   ├── diaryStore.ts            # 日记状态
│   └── analysisStore.ts         # 分析状态
└── utils/
    ├── api.ts                   # API封装
    └── constants.ts             # 常量定义
```



---

**文档版本**：v1.0  
**创建日期**：2026-02-05  
**技术负责人**：研发团队  
**审核状态**：待审核

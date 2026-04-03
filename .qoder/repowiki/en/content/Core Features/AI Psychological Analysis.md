# AI Psychological Analysis

<cite>
**Referenced Files in This Document**
- [ai.py](file://backend/app/api/v1/ai.py)
- [rag_service.py](file://backend/app/services/rag_service.py)
- [orchestrator.py](file://backend/app/agents/orchestrator.py)
- [agent_impl.py](file://backend/app/agents/agent_impl.py)
- [prompts.py](file://backend/app/agents/prompts.py)
- [state.py](file://backend/app/agents/state.py)
- [llm.py](file://backend/app/agents/llm.py)
- [diary_service.py](file://backend/app/services/diary_service.py)
- [qdrant_memory_service.py](file://backend/app/services/qdrant_memory_service.py)
- [diary.py](file://backend/app/models/diary.py)
- [ai.py](file://backend/app/schemas/ai.py)
- [diaries.py](file://backend/app/api/v1/diaries.py)
- [community.py](file://backend/app/api/v1/community.py)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document explains the AI Psychological Analysis feature that powers multi-day diary analysis, retrieval-augmented generation (RAG), the Satir Iceberg Model, hybrid evidence selection, agent orchestration, social content generation, visualization-ready results, backend architecture, memory management with Qdrant, and streaming response handling. It also provides examples of analysis workflows, prompt engineering strategies, and result interpretation guidelines.

## Project Structure
The AI Psychological Analysis spans backend APIs, agent orchestration, RAG services, memory services, and persistence models. The most relevant modules are:
- API endpoints for analysis, guidance, and social content
- Agent orchestration coordinating multiple specialized agents
- RAG service implementing hybrid lexical and semantic retrieval
- Memory service integrating Qdrant for vector-based recall
- Persistence models for diaries, timelines, and AI analysis results
- Schemas defining request/response contracts

```mermaid
graph TB
subgraph "API Layer"
A1["ai.py<br/>Analysis endpoints"]
A2["diaries.py<br/>Diary/Timeline endpoints"]
A3["community.py<br/>Community endpoints"]
end
subgraph "Agent System"
O["orchestrator.py<br/>AgentOrchestrator"]
I["agent_impl.py<br/>Agents (Context, Timeline, Satir, Social)"]
P["prompts.py<br/>Prompt templates"]
S["state.py<br/>AnalysisState"]
L["llm.py<br/>DeepSeek client"]
end
subgraph "Services"
R["rag_service.py<br/>DiaryRAGService"]
Q["qdrant_memory_service.py<br/>QdrantDiaryMemoryService"]
D["diary_service.py<br/>Diary/Timeline services"]
end
subgraph "Persistence"
M1["diary.py<br/>Diary, TimelineEvent, AIAnalysis"]
end
A1 --> O
O --> I
I --> P
I --> L
A1 --> R
A1 --> Q
A1 --> D
D --> M1
R --> M1
Q --> M1
```

**Diagram sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [orchestrator.py:1-176](file://backend/app/agents/orchestrator.py#L1-L176)
- [agent_impl.py:1-484](file://backend/app/agents/agent_impl.py#L1-L484)
- [prompts.py:1-244](file://backend/app/agents/prompts.py#L1-L244)
- [state.py:1-45](file://backend/app/agents/state.py#L1-L45)
- [llm.py:1-220](file://backend/app/agents/llm.py#L1-L220)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [diary_service.py:1-637](file://backend/app/services/diary_service.py#L1-L637)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)

**Section sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [orchestrator.py:1-176](file://backend/app/agents/orchestrator.py#L1-L176)
- [agent_impl.py:1-484](file://backend/app/agents/agent_impl.py#L1-L484)
- [prompts.py:1-244](file://backend/app/agents/prompts.py#L1-L244)
- [state.py:1-45](file://backend/app/agents/state.py#L1-L45)
- [llm.py:1-220](file://backend/app/agents/llm.py#L1-L220)
- [diary_service.py:1-637](file://backend/app/services/diary_service.py#L1-L637)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)

## Core Components
- Multi-day analysis pipeline: Aggregates diary windows, builds integrated content, and orchestrates agents for time-axis extraction, Satir Iceberg analysis, and social content generation.
- RAG evidence selection: Hybrid BM25 + recency + importance + emotion intensity + repetition + people hit + source bonus ranking.
- Satir Iceberg Model: Five-layer analysis (behavior → emotion → cognition → beliefs → core self) with therapeutic response synthesis.
- Agent orchestration: Structured workflow with context collection, timeline extraction, layered analysis, and social content creation.
- Social content generation: Personalized posts aligned with user’s social style and past samples.
- Backend architecture: FastAPI endpoints, SQLAlchemy models, async services, and optional Qdrant vector memory.
- Streaming responses: DeepSeek client supports streaming mode for progressive token delivery.

**Section sources**
- [ai.py:267-403](file://backend/app/api/v1/ai.py#L267-L403)
- [rag_service.py:210-317](file://backend/app/services/rag_service.py#L210-L317)
- [agent_impl.py:205-394](file://backend/app/agents/agent_impl.py#L205-L394)
- [orchestrator.py:27-131](file://backend/app/agents/orchestrator.py#L27-L131)
- [llm.py:94-143](file://backend/app/agents/llm.py#L94-L143)

## Architecture Overview
The system integrates user-level diary aggregation, RAG-based evidence selection, agent-driven psychological analysis, and social content generation. Results are persisted and can be retrieved later for visualization and further analysis.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "ai.py"
participant Orchestrator as "AgentOrchestrator"
participant Agents as "AgentImpl"
participant LLM as "DeepSeekClient"
participant RAG as "DiaryRAGService"
participant DB as "SQLAlchemy Models"
Client->>API : POST /ai/analyze
API->>DB : Load diaries in window
API->>RAG : Build chunks + retrieve candidates
RAG-->>API : Evidence list
API->>Orchestrator : analyze_diary(...)
Orchestrator->>Agents : ContextCollectorAgent
Agents->>LLM : Chat (JSON)
LLM-->>Agents : JSON payload
Orchestrator->>Agents : TimelineManagerAgent
Agents->>LLM : Chat (JSON)
LLM-->>Agents : JSON payload
Orchestrator->>Agents : SatirTherapistAgent (Emotion/Belief/Existence)
Agents->>LLM : Chat (JSON)
LLM-->>Agents : JSON payload
Orchestrator->>Agents : SocialContentCreatorAgent
Agents->>LLM : Chat (text)
LLM-->>Agents : Text payload
Agents-->>Orchestrator : AnalysisState
Orchestrator-->>API : Formatted result
API->>DB : Persist AIAnalysis + TimelineEvent
API-->>Client : AnalysisResponse
```

**Diagram sources**
- [ai.py:406-638](file://backend/app/api/v1/ai.py#L406-L638)
- [orchestrator.py:27-131](file://backend/app/agents/orchestrator.py#L27-L131)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [rag_service.py:147-208](file://backend/app/services/rag_service.py#L147-L208)
- [diary.py:102-132](file://backend/app/models/diary.py#L102-L132)

## Detailed Component Analysis

### Multi-Day Analysis Pipeline
- Window selection: Uses a configurable window_days and max_diaries to fetch diaries for analysis.
- Integrated content: Concatenates diary sections with metadata to form a unified corpus.
- User profile: Aggregated top emotions, average importance, and analysis scope.
- Timeline context: Retrieves recent events within the analysis window for richer context.
- Agent orchestration: Executes context collection, timeline extraction, Satir layers, and social content generation.
- Persistence: Saves AIAnalysis and updates TimelineEvent; marks diaries as analyzed.

```mermaid
flowchart TD
Start(["Start /ai/analyze"]) --> Fetch["Fetch diaries in window"]
Fetch --> Sort["Sort by date/time"]
Sort --> Build["Build integrated content"]
Build --> Profile["Compute user profile"]
Profile --> Timeline["Load timeline context"]
Timeline --> Orchestrator["AgentOrchestrator.analyze_diary"]
Orchestrator --> Save["Persist AIAnalysis + TimelineEvent"]
Save --> Return(["Return AnalysisResponse"])
```

**Diagram sources**
- [ai.py:406-638](file://backend/app/api/v1/ai.py#L406-L638)

**Section sources**
- [ai.py:406-638](file://backend/app/api/v1/ai.py#L406-L638)

### RAG Evidence Selection (Hybrid BM25 + Lexical/Semantic)
- Chunk building: Splits content into overlapping segments and builds daily summaries; extracts people, emotion intensity, and theme keys.
- Retrieval: Applies BM25 with idf/tf normalization, plus recency, importance, emotion intensity, repetition, people hit, and source bonus.
- Ranking formula: Weighted combination of BM25-normalized score and auxiliary signals.
- Deduplication: Jaccard similarity threshold prevents redundant evidence while respecting per-diary and per-reason limits.

```mermaid
flowchart TD
A["Chunks from build_chunks"] --> B["Tokenize query"]
B --> C["BM25 scoring per chunk"]
C --> D["Normalize BM25"]
D --> E["Combine with recency/importance/emotion/repetition/people/source"]
E --> F["Rank and truncate top_k"]
F --> G["Deduplicate by Jaccard similarity"]
G --> H["Return evidence list"]
```

**Diagram sources**
- [rag_service.py:147-356](file://backend/app/services/rag_service.py#L147-L356)

**Section sources**
- [rag_service.py:147-356](file://backend/app/services/rag_service.py#L147-L356)

### Satir Iceberg Model Implementation
- Behavior layer: Captures the observable event from the diary.
- Emotion layer: Extracts surface and underlying emotions with intensity.
- Cognitive layer: Identifies irrational beliefs and automatic thoughts.
- Belief layer: Surfaces core beliefs and life rules.
- Core Self layer: Connects to deepest desires and existence insights.
- Therapeutic response: Synthesizes a warm, structured reply grounded in the five layers.

```mermaid
classDiagram
class AnalysisState {
+user_id : int
+diary_id : int
+diary_content : str
+user_profile : Dict
+timeline_context : List
+behavior_layer : Dict
+emotion_layer : Dict
+cognitive_layer : Dict
+belief_layer : Dict
+core_self_layer : Dict
+timeline_event : Dict
+social_posts : List
+therapeutic_response : str
+processing_time : float
+error : Optional
+current_step : str
+agent_runs : List
}
class SatirTherapistAgent {
+analyze_emotion_layer(state)
+analyze_belief_layer(state)
+analyze_existence_layer(state)
+generate_response(state)
}
AnalysisState --> SatirTherapistAgent : "updates layers"
```

**Diagram sources**
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)
- [agent_impl.py:205-394](file://backend/app/agents/agent_impl.py#L205-L394)

**Section sources**
- [agent_impl.py:205-394](file://backend/app/agents/agent_impl.py#L205-L394)
- [prompts.py:62-163](file://backend/app/agents/prompts.py#L62-L163)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)

### Agent Orchestration System
- Responsibilities:
  - ContextCollectorAgent: Builds contextual profile and timeline context.
  - TimelineManagerAgent: Extracts structured events with emotion, type, and importance.
  - SatirTherapistAgent: Runs three specialized steps (emotion, belief, existence) and generates a therapeutic response.
  - SocialContentCreatorAgent: Produces multiple social post variants aligned with user style.
- Formatting: Converts internal state into a standardized AnalysisResponse with metadata and agent run logs.

```mermaid
sequenceDiagram
participant Orchestrator as "AgentOrchestrator"
participant CCA as "ContextCollectorAgent"
participant TMA as "TimelineManagerAgent"
participant STA as "SatirTherapistAgent"
participant SCA as "SocialContentCreatorAgent"
Orchestrator->>CCA : collect(user_profile, timeline_context)
CCA-->>Orchestrator : state updated
Orchestrator->>TMA : extract_event(state)
TMA-->>Orchestrator : timeline_event
Orchestrator->>STA : analyze_emotion_layer
Orchestrator->>STA : analyze_belief_layer
Orchestrator->>STA : analyze_existence_layer
Orchestrator->>STA : generate_response
Orchestrator->>SCA : generate_posts(state, user_profile)
SCA-->>Orchestrator : social_posts
Orchestrator-->>Orchestrator : format_result
```

**Diagram sources**
- [orchestrator.py:27-131](file://backend/app/agents/orchestrator.py#L27-L131)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)

**Section sources**
- [orchestrator.py:18-171](file://backend/app/agents/orchestrator.py#L18-L171)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)

### Social Content Generation for Community Sharing
- Uses user’s social style and stored samples to produce multiple post variants.
- Falls back gracefully if parsing fails.
- Integrates with community endpoints for sharing after analysis.

```mermaid
sequenceDiagram
participant API as "ai.py"
participant SCA as "SocialContentCreatorAgent"
participant LLM as "DeepSeekClient"
participant DB as "SocialPostSample"
API->>DB : Load user samples
API->>SCA : generate_posts(state, user_profile)
SCA->>LLM : Chat (text)
LLM-->>SCA : Text payload
SCA-->>API : posts[]
API-->>Client : AnalysisResponse with social_posts
```

**Diagram sources**
- [ai.py:770-800](file://backend/app/api/v1/ai.py#L770-L800)
- [agent_impl.py:396-484](file://backend/app/agents/agent_impl.py#L396-L484)
- [diary.py:135-153](file://backend/app/models/diary.py#L135-L153)

**Section sources**
- [ai.py:770-800](file://backend/app/api/v1/ai.py#L770-L800)
- [agent_impl.py:396-484](file://backend/app/agents/agent_impl.py#L396-L484)
- [diary.py:135-153](file://backend/app/models/diary.py#L135-L153)

### Backend Service Architecture
- FastAPI endpoints under /ai, /diaries, and /community.
- SQLAlchemy models for diaries, timeline events, AI analyses, and social samples.
- Services for diary/timeline management and optional Qdrant vector memory.
- Schemas define request/response shapes for type safety.

```mermaid
graph TB
API_AI["ai.py"] --> Models["diary.py"]
API_DIARY["diaries.py"] --> Models
API_COMMUNITY["community.py"] --> Models
API_AI --> Services["diary_service.py"]
API_AI --> RAG["rag_service.py"]
API_AI --> Memory["qdrant_memory_service.py"]
API_AI --> Schemas["ai.py (schemas)"]
```

**Diagram sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [diaries.py:1-501](file://backend/app/api/v1/diaries.py#L1-L501)
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)
- [diary_service.py:1-637](file://backend/app/services/diary_service.py#L1-L637)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [ai.py:1-108](file://backend/app/schemas/ai.py#L1-L108)

**Section sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [diaries.py:1-501](file://backend/app/api/v1/diaries.py#L1-L501)
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)
- [diary_service.py:1-637](file://backend/app/services/diary_service.py#L1-L637)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [ai.py:1-108](file://backend/app/schemas/ai.py#L1-L108)

### Memory Management with Qdrant
- Optional vector memory service that synchronizes user diaries to a Qdrant collection and performs cosine-distance searches.
- Embedding via token hashing with configurable dimension.
- Retrieval context method ensures up-to-date vectors before search.

```mermaid
flowchart TD
QStart["retrieve_context(user_id, query)"] --> Sync["sync_user_diaries(user_id)"]
Sync --> Search["search(query, user_id)"]
Search --> QEnd["Return hits"]
```

**Diagram sources**
- [qdrant_memory_service.py:175-186](file://backend/app/services/qdrant_memory_service.py#L175-L186)

**Section sources**
- [qdrant_memory_service.py:45-186](file://backend/app/services/qdrant_memory_service.py#L45-L186)

### Streaming Response Handling
- DeepSeek client supports streaming mode and yields tokens incrementally.
- Useful for progressive UI updates during long-running analysis.

```mermaid
sequenceDiagram
participant Client as "Client"
participant LLM as "DeepSeekClient"
Client->>LLM : stream_chat(messages, temperature)
loop For each token
LLM-->>Client : yield content
end
```

**Diagram sources**
- [llm.py:94-143](file://backend/app/agents/llm.py#L94-L143)

**Section sources**
- [llm.py:94-143](file://backend/app/agents/llm.py#L94-L143)

### Analysis Result Visualization and Recommendations
- Evidence list with scores and reasons enables trend identification and targeted insights.
- Metadata includes analysis scope, window, counts, and retrieval strategy.
- Visualization-ready fields: emotion trends, continuity signals, turning points, growth suggestions.

```mermaid
classDiagram
class ComprehensiveAnalysisResponse {
+summary : str
+key_themes : List[str]
+emotion_trends : List[str]
+continuity_signals : List[str]
+turning_points : List[str]
+growth_suggestions : List[str]
+evidence : List[EvidenceItem]
+metadata : Dict
}
class EvidenceItem {
+diary_id : int
+diary_date : str
+title : str
+snippet : str
+reason : str
+score : float
}
ComprehensiveAnalysisResponse --> EvidenceItem : "contains"
```

**Diagram sources**
- [ai.py:32-42](file://backend/app/api/v1/ai.py#L32-L42)
- [ai.py:23-41](file://backend/app/schemas/ai.py#L23-L41)

**Section sources**
- [ai.py:267-403](file://backend/app/api/v1/ai.py#L267-L403)
- [ai.py:23-41](file://backend/app/schemas/ai.py#L23-L41)

## Dependency Analysis
- API depends on agent orchestration, RAG service, and persistence models.
- Agents depend on prompt templates and the DeepSeek client.
- RAG service depends on diary models for chunking and scoring.
- Qdrant memory service optionally augments retrieval with vectors.
- Diaries and timelines are tightly coupled with analysis persistence.

```mermaid
graph LR
API["ai.py"] --> ORCH["orchestrator.py"]
ORCH --> AGENTS["agent_impl.py"]
AGENTS --> PROMPTS["prompts.py"]
AGENTS --> LLM["llm.py"]
API --> RAG["rag_service.py"]
API --> DB["diary.py"]
API --> QDR["qdrant_memory_service.py"]
DIARY_API["diaries.py"] --> DB
COMM_API["community.py"] --> DB
```

**Diagram sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [orchestrator.py:1-176](file://backend/app/agents/orchestrator.py#L1-L176)
- [agent_impl.py:1-484](file://backend/app/agents/agent_impl.py#L1-L484)
- [prompts.py:1-244](file://backend/app/agents/prompts.py#L1-L244)
- [llm.py:1-220](file://backend/app/agents/llm.py#L1-L220)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)
- [diaries.py:1-501](file://backend/app/api/v1/diaries.py#L1-L501)
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)

**Section sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [orchestrator.py:1-176](file://backend/app/agents/orchestrator.py#L1-L176)
- [agent_impl.py:1-484](file://backend/app/agents/agent_impl.py#L1-L484)
- [prompts.py:1-244](file://backend/app/agents/prompts.py#L1-L244)
- [llm.py:1-220](file://backend/app/agents/llm.py#L1-L220)
- [rag_service.py:1-360](file://backend/app/services/rag_service.py#L1-L360)
- [qdrant_memory_service.py:1-190](file://backend/app/services/qdrant_memory_service.py#L1-L190)
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)
- [diaries.py:1-501](file://backend/app/api/v1/diaries.py#L1-L501)
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)

## Performance Considerations
- RAG scoring uses BM25 with idf/tf normalization and auxiliary signals; tune weights and thresholds for domain fit.
- Deduplication reduces redundancy; adjust similarity threshold and per-reason limits to balance recall vs. diversity.
- Vector memory (Qdrant) adds latency; enable only when beneficial and ensure collection initialization.
- Agent orchestration runs multiple LLM calls; consider temperature and response_format trade-offs for cost and quality.
- Streaming responses improve UX for long generations.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
- JSON parsing failures: The system includes robust parsers that handle raw JSON, fenced code blocks, and incremental decoding; errors are captured and surfaced.
- Persistence warnings: Analysis persists AIAnalysis and TimelineEvent; failures are logged and returned in metadata without blocking the response.
- Fallbacks: Daily guidance and social content generation include fallbacks when AI fails.
- Error propagation: Agent runs capture start/end timestamps and errors for diagnostics.

**Section sources**
- [agent_impl.py:25-68](file://backend/app/agents/agent_impl.py#L25-L68)
- [ai.py:534-591](file://backend/app/api/v1/ai.py#L534-L591)
- [ai.py:199-206](file://backend/app/api/v1/ai.py#L199-L206)
- [agent_impl.py:396-484](file://backend/app/agents/agent_impl.py#L396-L484)

## Conclusion
The AI Psychological Analysis feature combines multi-day diary aggregation, hybrid RAG evidence selection, structured Satir Iceberg analysis, and social content generation. Its modular agent orchestration, robust persistence, and optional vector memory deliver a scalable foundation for psychological insights and community sharing.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Example Workflows
- Multi-day integrated analysis:
  - Request: specify window_days and max_diaries.
  - Process: fetch diaries, build integrated content, run agents, persist results.
  - Output: structured analysis with evidence and metadata.
- Comprehensive user-level analysis:
  - Request: window_days and focus.
  - Process: build chunks, retrieve candidates via hybrid BM25, deduplicate, and synthesize JSON.
  - Output: themes, trends, signals, turning points, and growth suggestions.

**Section sources**
- [ai.py:267-403](file://backend/app/api/v1/ai.py#L267-L403)
- [ai.py:406-638](file://backend/app/api/v1/ai.py#L406-L638)

### Prompt Engineering Strategies
- Use explicit roles and JSON response_format for deterministic outputs.
- Provide concise examples and constraints in prompts (e.g., character limits, categories).
- Separate system and user prompts to control tone and structure.

**Section sources**
- [prompts.py:9-28](file://backend/app/agents/prompts.py#L9-L28)
- [prompts.py:33-57](file://backend/app/agents/prompts.py#L33-L57)
- [prompts.py:62-163](file://backend/app/agents/prompts.py#L62-L163)
- [prompts.py:168-208](file://backend/app/agents/prompts.py#L168-L208)

### Result Interpretation Guidelines
- Evidence scoring: Higher scores indicate stronger matches; use reasons to understand retrieval intent.
- Metadata: Use analysis_scope, window, and retrieval strategy to contextualize findings.
- Trends and signals: Cross-reference emotion trends with continuity signals and turning points for narrative coherence.

**Section sources**
- [ai.py:386-403](file://backend/app/api/v1/ai.py#L386-L403)
- [rag_service.py:319-356](file://backend/app/services/rag_service.py#L319-L356)
# AI System Architecture

<cite>
**Referenced Files in This Document**
- [main.py](file://backend/main.py)
- [config.py](file://backend/app/core/config.py)
- [ai.py](file://backend/app/api/v1/ai.py)
- [orchestrator.py](file://backend/app/agents/orchestrator.py)
- [agent_impl.py](file://backend/app/agents/agent_impl.py)
- [state.py](file://backend/app/agents/state.py)
- [prompts.py](file://backend/app/agents/prompts.py)
- [llm.py](file://backend/app/agents/llm.py)
- [rag_service.py](file://backend/app/services/rag_service.py)
- [qdrant_memory_service.py](file://backend/app/services/qdrant_memory_service.py)
- [diary.py](file://backend/app/models/diary.py)
- [scheduler_service.py](file://backend/app/services/scheduler_service.py)
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
This document describes the AI system architecture of the 映记 intelligent system. It covers the multi-agent architecture with specialized agents for psychological analysis, content generation, and memory management; the agent orchestration system coordinating workflow execution; the Retrieval-Augmented Generation (RAG) implementation with a custom BM25 algorithm, diary chunking, and evidence deduplication; vector database integration with Qdrant for semantic search and memory storage; LLM integration with DeepSeek API, streaming response handling, and temperature control mechanisms; prompt engineering architecture with specialized templates; and the state management system for maintaining conversation context and session data. System diagrams illustrate the AI pipeline from user input through multiple agents to final output, including error handling and fallback mechanisms.

## Project Structure
The backend is organized around modular components:
- API layer: FastAPI routers exposing AI analysis endpoints
- Agents: Specialized agents for context collection, timeline extraction, psychological analysis (Satir Iceberg), and social content creation
- Services: RAG service for diary retrieval, Qdrant memory service for vector search, scheduler for daily tasks
- Models: SQLAlchemy ORM models for diaries, timeline events, AI analyses, and social samples
- Core: Configuration management and dependency injection

```mermaid
graph TB
subgraph "API Layer"
AI_API["AI API Router<br/>ai.py"]
end
subgraph "Agents"
Orchestrator["AgentOrchestrator<br/>orchestrator.py"]
CCAgent["ContextCollectorAgent<br/>agent_impl.py"]
TLAgent["TimelineManagerAgent<br/>agent_impl.py"]
SA["SatirTherapistAgent<br/>agent_impl.py"]
SC["SocialContentCreatorAgent<br/>agent_impl.py"]
Prompts["Prompts<br/>prompts.py"]
State["AnalysisState<br/>state.py"]
LLMAdapter["LLM Adapter<br/>llm.py"]
end
subgraph "Services"
RAG["DiaryRAGService<br/>rag_service.py"]
Qdrant["QdrantMemoryService<br/>qdrant_memory_service.py"]
Scheduler["Scheduler Loop<br/>scheduler_service.py"]
end
subgraph "Models"
DiaryModel["Diary/Timeline/AIAnalysis/Samples<br/>diary.py"]
end
Config["Settings<br/>config.py"]
AI_API --> Orchestrator
Orchestrator --> CCAgent
Orchestrator --> TLAgent
Orchestrator --> SA
Orchestrator --> SC
CCAgent --> Prompts
TLAgent --> Prompts
SA --> Prompts
SC --> Prompts
CCAgent --> LLMAdapter
TLAgent --> LLMAdapter
SA --> LLMAdapter
SC --> LLMAdapter
AI_API --> RAG
AI_API --> Qdrant
AI_API --> DiaryModel
Scheduler --> AI_API
Config --> LLMAdapter
Config --> Qdrant
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
- [diary.py:1-186](file://backend/app/models/diary.py#L1-L186)
- [scheduler_service.py:1-130](file://backend/app/services/scheduler_service.py#L1-L130)
- [config.py:1-105](file://backend/app/core/config.py#L1-L105)

**Section sources**
- [main.py:1-119](file://backend/main.py#L1-L119)
- [config.py:1-105](file://backend/app/core/config.py#L1-L105)

## Core Components
- AgentOrchestrator: Coordinates multi-agent workflows for diary analysis, including context collection, timeline extraction, Satir ice berg analysis, and social content generation.
- Agent implementations: ContextCollectorAgent, TimelineManagerAgent, SatirTherapistAgent (with sub-steps for emotion, belief/cognition, existence layers, and response generation), SocialContentCreatorAgent.
- Prompt templates: Specialized prompts for each agent and system-level prompts for tone and role.
- LLM integration: DeepSeek API client with synchronous and streaming modes, temperature control, and JSON response formatting.
- RAG service: Custom BM25-based retrieval with diary chunking, recency weighting, importance scoring, emotion intensity, repetition penalty, people hit bonus, and evidence deduplication.
- Qdrant memory service: Vector embedding via hashing, collection management, user diary synchronization, and semantic search with filters.
- State management: TypedDict-based AnalysisState capturing inputs, intermediate results, outputs, and metadata.
- API endpoints: Comprehensive analysis, daily guidance, title generation, social style samples, and result persistence.

**Section sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [prompts.py:1-244](file://backend/app/agents/prompts.py#L1-L244)
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)
- [qdrant_memory_service.py:45-190](file://backend/app/services/qdrant_memory_service.py#L45-L190)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)
- [ai.py:267-639](file://backend/app/api/v1/ai.py#L267-L639)

## Architecture Overview
The system follows a pipeline-driven AI architecture:
- User input enters via FastAPI endpoints.
- The orchestrator composes multiple agents to perform layered analysis.
- LLM calls are executed through a unified adapter that integrates with DeepSeek API.
- Memory retrieval uses both lexical RAG (custom BM25) and vector search (Qdrant).
- Results are persisted and returned to clients, with robust error handling and fallbacks.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "AI API Router"
participant Orchestrator as "AgentOrchestrator"
participant CCAgent as "ContextCollectorAgent"
participant TLAgent as "TimelineManagerAgent"
participant SA as "SatirTherapistAgent"
participant SC as "SocialContentCreatorAgent"
participant LLM as "DeepSeekClient"
participant RAG as "DiaryRAGService"
participant Qdrant as "QdrantMemoryService"
participant DB as "SQLAlchemy Models"
Client->>API : POST /ai/analyze
API->>RAG : build_chunks(diaries)
RAG-->>API : chunks
API->>Qdrant : retrieve_context(user_id, query)
Qdrant-->>API : context snippets
API->>Orchestrator : analyze_diary(...)
Orchestrator->>CCAgent : collect(user_profile, timeline_context)
CCAgent->>LLM : chat_with_system(system, prompt, temperature)
LLM-->>CCAgent : JSON context
Orchestrator->>TLAgent : extract_event(diary_content)
TLAgent->>LLM : chat_with_system(system, prompt, temperature)
LLM-->>TLAgent : JSON event
Orchestrator->>SA : analyze_emotion_layer(...)
SA->>LLM : chat_with_system(system, prompt, temperature)
LLM-->>SA : JSON emotion
Orchestrator->>SA : analyze_belief_layer(...)
SA->>LLM : chat_with_system(system, prompt, temperature)
LLM-->>SA : JSON belief/cognition
Orchestrator->>SA : analyze_existence_layer(...)
SA->>LLM : chat_with_system(system, prompt, temperature)
LLM-->>SA : JSON core_self
Orchestrator->>SA : generate_response(...)
SA->>LLM : chat(system, prompt)
LLM-->>SA : therapeutic response
Orchestrator->>SC : generate_posts(state, user_profile)
SC->>LLM : chat(system, prompt)
LLM-->>SC : posts JSON
Orchestrator-->>API : formatted result
API->>DB : persist timeline event + AI analysis
DB-->>API : success/failure
API-->>Client : AnalysisResponse
```

**Diagram sources**
- [ai.py:406-639](file://backend/app/api/v1/ai.py#L406-L639)
- [orchestrator.py:27-171](file://backend/app/agents/orchestrator.py#L27-L171)
- [agent_impl.py:100-483](file://backend/app/agents/agent_impl.py#L100-L483)
- [llm.py:21-143](file://backend/app/agents/llm.py#L21-L143)
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)
- [qdrant_memory_service.py:175-186](file://backend/app/services/qdrant_memory_service.py#L175-L186)
- [diary.py:29-153](file://backend/app/models/diary.py#L29-L153)

## Detailed Component Analysis

### Multi-Agent Orchestration
The orchestrator coordinates four specialized agents:
- Agent 0: ContextCollectorAgent collects user profile and timeline context, normalizing inputs for downstream agents.
- Agent A: TimelineManagerAgent extracts structured timeline events from diary content.
- Agent B: SatirTherapistAgent performs five-layer psychological analysis:
  - Emotion layer: surface vs underlying emotions
  - Cognitive layer: irrational beliefs and automatic thoughts
  - Belief layer: core beliefs and life rules
  - Existence layer: deepest desires and insights
  - Response generation: therapeutic reply synthesized from all layers
- Agent C: SocialContentCreatorAgent generates multiple versions of social media posts tailored to user style.

```mermaid
classDiagram
class AgentOrchestrator {
+analyze_diary(user_id, diary_id, diary_content, diary_date, user_profile, timeline_context) Dict
+format_result(state) Dict
}
class ContextCollectorAgent {
+collect(state, user_profile, timeline_context) AnalysisState
}
class TimelineManagerAgent {
+extract_event(state) AnalysisState
}
class SatirTherapistAgent {
+analyze_emotion_layer(state) AnalysisState
+analyze_belief_layer(state) AnalysisState
+analyze_existence_layer(state) AnalysisState
+generate_response(state) AnalysisState
}
class SocialContentCreatorAgent {
+generate_posts(state, user_profile) AnalysisState
}
class AnalysisState
AgentOrchestrator --> ContextCollectorAgent : "uses"
AgentOrchestrator --> TimelineManagerAgent : "uses"
AgentOrchestrator --> SatirTherapistAgent : "uses"
AgentOrchestrator --> SocialContentCreatorAgent : "uses"
ContextCollectorAgent --> AnalysisState : "updates"
TimelineManagerAgent --> AnalysisState : "updates"
SatirTherapistAgent --> AnalysisState : "updates"
SocialContentCreatorAgent --> AnalysisState : "updates"
```

**Diagram sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)

**Section sources**
- [orchestrator.py:27-171](file://backend/app/agents/orchestrator.py#L27-L171)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)

### RAG Implementation with Custom BM25
The RAG service implements:
- DiaryChunk data model with tokenization, theme keys, and metadata
- Chunk building from summaries and raw content with overlap
- BM25 scoring with IDF, TF, and length normalization
- Weighted ranking incorporating recency, importance, emotion intensity, repetition, people hit, and source type bonus
- Evidence deduplication by fingerprinting and Jaccard similarity thresholds

```mermaid
flowchart TD
Start(["Build Chunks"]) --> Split["Split into Segments<br/>by sentence boundaries"]
Split --> BuildSummary["Build Daily Summary"]
BuildSummary --> AddSummaryChunk["Add Summary Chunk"]
Split --> RawChunks["Iterate Raw Segments"]
RawChunks --> Tokenize["Tokenize Title + Segment"]
Tokenize --> AddRawChunk["Add Raw Chunk"]
AddSummaryChunk --> Filter["Filter by Source Types"]
AddRawChunk --> Filter
Filter --> BM25["Compute BM25 Scores"]
BM25 --> Weight["Apply Weights:<br/>Recency + Importance + Emotion + Repetition + People + Source Bonus"]
Weight --> Normalize["Normalize BM25"]
Normalize --> Rank["Rank Candidates Descending"]
Rank --> Dedup["Deduplicate by Fingerprint + Jaccard Similarity"]
Dedup --> TopK["Select Top-K"]
TopK --> End(["Return Evidence"])
```

**Diagram sources**
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)

**Section sources**
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)

### Vector Database Integration with Qdrant
The Qdrant service:
- Ensures collection existence with cosine distance vectors
- Hashes tokens into fixed-dimension vectors for embedding
- Synchronizes user diaries to Qdrant points with payloads
- Performs vector search with user filters and returns structured results
- Provides retrieve_context that syncs before search for real-time freshness

```mermaid
sequenceDiagram
participant API as "AI API"
participant QMS as "QdrantMemoryService"
participant HTTP as "HTTPX Client"
participant Q as "Qdrant Server"
API->>QMS : sync_user_diaries(db, user_id)
QMS->>QMS : fetch_user_diaries(limit)
QMS->>QMS : hash_embedding(text, dim)
QMS->>HTTP : PUT /collections/{collection}/points
HTTP->>Q : Upsert Points
Q-->>HTTP : OK
HTTP-->>QMS : Response
QMS-->>API : Count
API->>QMS : search(query, user_id, top_k)
QMS->>QMS : hash_embedding(query, dim)
QMS->>HTTP : POST /collections/{collection}/points/search
HTTP->>Q : Vector Search
Q-->>HTTP : Hits
HTTP-->>QMS : JSON Result
QMS-->>API : Snippets
```

**Diagram sources**
- [qdrant_memory_service.py:45-190](file://backend/app/services/qdrant_memory_service.py#L45-L190)

**Section sources**
- [qdrant_memory_service.py:45-190](file://backend/app/services/qdrant_memory_service.py#L45-L190)

### LLM Integration with DeepSeek API
The LLM integration:
- DeepSeekClient supports synchronous chat, system-prompt chat, and streaming chat
- Temperature controls per agent type (analytical, creative, general)
- Response format enforcement for JSON outputs
- LangChain compatibility wrapper (ChatOpenAI) for agent implementations

```mermaid
classDiagram
class DeepSeekClient {
+chat(messages, temperature, max_tokens, response_format) str
+chat_with_system(system_prompt, user_prompt, temperature, response_format) str
+stream_chat(messages, temperature) AsyncGenerator~str~
}
class ChatOpenAI {
+ainvoke(messages, response_format) Message
}
class Settings {
+deepseek_api_key : str
+deepseek_base_url : str
}
ChatOpenAI --> DeepSeekClient : "delegates"
DeepSeekClient --> Settings : "reads"
```

**Diagram sources**
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)
- [config.py:62-70](file://backend/app/core/config.py#L62-L70)

**Section sources**
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)
- [config.py:62-70](file://backend/app/core/config.py#L62-L70)

### Prompt Engineering Architecture
Specialized prompt templates guide each agent:
- ContextCollectorPrompt: Extracts current mood, main events, concerns, hopes
- TimelineExtractorPrompt: Produces event summary, emotion tag, importance score, entity mentions
- SatirEmotionPrompt: Emotion layer analysis
- SatirBeliefPrompt: Cognitive and belief layer analysis
- SatirExistencePrompt: Existence layer insights
- SatirResponderPrompt: Therapeutic response synthesis
- SocialPostCreatorPrompt: Multi-version social posts
- System prompts define roles and tones for analysts and social creators

**Section sources**
- [prompts.py:7-244](file://backend/app/agents/prompts.py#L7-L244)

### State Management System
AnalysisState captures:
- Inputs: user_id, diary_id, diary_content, diary_date, user_profile, timeline_context
- Intermediate results: related_memories, behavior/emotion/cognitive/belief/core_self layers, timeline_event
- Outputs: therapeutic_response, social_posts
- Metadata: processing_time, error, current_step, agent_runs

**Section sources**
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)

### API Endpoints and Workflows
Key endpoints:
- /ai/analyze: Full integrated analysis with orchestration, persistence, and error handling
- /ai/comprehensive-analysis: User-level RAG analysis over configurable windows
- /ai/daily-guidance: Personalized writing prompts
- /ai/generate-title: Title suggestions
- /ai/social-style-samples: Manage user social post samples
- /ai/result/{diary_id}: Retrieve saved analysis results
- Background task endpoint (placeholder for async mode)

```mermaid
flowchart TD
A["POST /ai/analyze"] --> B["Fetch diaries in window"]
B --> C["Build integrated content"]
C --> D["Build user profile & timeline context"]
D --> E["Call Orchestrator.analyze_diary(...)"]
E --> F["Format result"]
F --> G["Persist timeline event + AI analysis"]
G --> H["Return AnalysisResponse"]
H --> I["Error handling with HTTPException"]
```

**Diagram sources**
- [ai.py:406-639](file://backend/app/api/v1/ai.py#L406-L639)

**Section sources**
- [ai.py:267-639](file://backend/app/api/v1/ai.py#L267-L639)

## Dependency Analysis
- API depends on orchestrator, RAG service, Qdrant service, and SQLAlchemy models
- Agents depend on prompts and LLM adapter
- LLM adapter depends on configuration for credentials and endpoints
- RAG service is standalone with internal utilities
- Qdrant service depends on configuration and SQLAlchemy models
- Scheduler runs independently and triggers refinement tasks

```mermaid
graph LR
API["ai.py"] --> Orchestrator["orchestrator.py"]
API --> RAG["rag_service.py"]
API --> Qdrant["qdrant_memory_service.py"]
API --> Models["diary.py"]
Orchestrator --> Agents["agent_impl.py"]
Agents --> Prompts["prompts.py"]
Agents --> LLM["llm.py"]
LLM --> Config["config.py"]
Qdrant --> Config
Scheduler["scheduler_service.py"] --> API
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
- [scheduler_service.py:1-130](file://backend/app/services/scheduler_service.py#L1-L130)
- [config.py:1-105](file://backend/app/core/config.py#L1-L105)

**Section sources**
- [ai.py:1-902](file://backend/app/api/v1/ai.py#L1-L902)
- [orchestrator.py:1-176](file://backend/app/agents/orchestrator.py#L1-L176)
- [agent_impl.py:1-484](file://backend/app/agents/agent_impl.py#L1-L484)
- [llm.py:1-220](file://backend/app/agents/llm.py#L1-L220)
- [config.py:1-105](file://backend/app/core/config.py#L1-L105)

## Performance Considerations
- Temperature tuning: Lower for analytical tasks (emotion/belief/existence), moderate for general, higher for creative content generation.
- Chunking strategy: Sentence-aware splitting with overlap to preserve context while controlling token counts.
- BM25 weights: Balanced combination of lexical match, recency, importance, emotion, repetition, and people hit to reduce noise.
- Vector dimension: Fixed 256-dimensional hashing embeddings for efficient Qdrant storage and search.
- Streaming: Available for interactive experiences; synchronous mode used for deterministic JSON outputs.
- Persistence: Batch writes for timeline events and AI analyses; error-safe rollback with warnings in metadata.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and fallbacks:
- JSON parsing failures: Multiple strategies (direct JSON, fenced code blocks, incremental decode) with explicit error messages.
- Agent failures: Each agent records run metadata with duration and error; orchestrator continues with defaults or degraded outputs.
- Qdrant unavailability: retrieve_context returns empty list; API falls back gracefully.
- RAG empty results: Hybrid retrieval with fallback query and evidence deduplication limits.
- HTTP exceptions: API endpoints wrap errors with HTTPException and include detailed messages.

**Section sources**
- [agent_impl.py:25-68](file://backend/app/agents/agent_impl.py#L25-L68)
- [agent_impl.py:136-141](file://backend/app/agents/agent_impl.py#L136-L141)
- [agent_impl.py:191-202](file://backend/app/agents/agent_impl.py#L191-L202)
- [agent_impl.py:293-298](file://backend/app/agents/agent_impl.py#L293-L298)
- [agent_impl.py:337-346](file://backend/app/agents/agent_impl.py#L337-L346)
- [agent_impl.py:388-392](file://backend/app/agents/agent_impl.py#L388-L392)
- [agent_impl.py:465-482](file://backend/app/agents/agent_impl.py#L465-L482)
- [qdrant_memory_service.py:175-186](file://backend/app/services/qdrant_memory_service.py#L175-L186)
- [ai.py:34-64](file://backend/app/api/v1/ai.py#L34-L64)
- [ai.py:372-384](file://backend/app/api/v1/ai.py#L372-L384)

## Conclusion
The 映记 intelligent system integrates a robust multi-agent AI architecture with specialized agents for psychological analysis, timeline extraction, and social content generation. The agent orchestration system coordinates these agents around a shared state, while the RAG implementation augments analysis with historical diary context using a custom BM25 algorithm and Qdrant vector search. LLM integration with DeepSeek API supports both synchronous and streaming modes with precise temperature control and JSON formatting. The system emphasizes reliability through structured error handling, fallback mechanisms, and persistent state management.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Data Models Overview
```mermaid
erDiagram
DIARY {
int id PK
int user_id FK
date diary_date
string title
text content
int importance_score
json emotion_tags
boolean is_analyzed
datetime created_at
datetime updated_at
}
TIMELINE_EVENT {
int id PK
int user_id FK
int diary_id FK
date event_date
string event_summary
string emotion_tag
int importance_score
string event_type
json related_entities
datetime created_at
}
AI_ANALYSIS {
int id PK
int user_id FK
int diary_id FK
json result_json
datetime created_at
datetime updated_at
}
SOCIAL_POST_SAMPLE {
int id PK
int user_id FK
text content
datetime created_at
}
DIARY ||--o{ TIMELINE_EVENT : "has"
DIARY ||--o{ AI_ANALYSIS : "analyzed_as"
USER ||--o{ DIARY : "owns"
USER ||--o{ TIMELINE_EVENT : "owns"
USER ||--o{ AI_ANALYSIS : "owns"
USER ||--o{ SOCIAL_POST_SAMPLE : "owns"
```

**Diagram sources**
- [diary.py:29-153](file://backend/app/models/diary.py#L29-L153)
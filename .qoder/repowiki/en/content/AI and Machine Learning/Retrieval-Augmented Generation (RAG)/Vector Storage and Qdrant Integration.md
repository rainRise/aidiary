# Vector Storage and Qdrant Integration

<cite>
**Referenced Files in This Document**
- [qdrant_memory_service.py](file://backend/app/services/qdrant_memory_service.py)
- [config.py](file://backend/app/core/config.py)
- [diary.py](file://backend/app/models/diary.py)
- [rag_service.py](file://backend/app/services/rag_service.py)
- [diaries.py](file://backend/app/api/v1/diaries.py)
- [requirements.txt](file://backend/requirements.txt)
- [.env.example](file://backend/.env.example)
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
This document explains the vector storage system and Qdrant integration used by the Retrieval-Augmented Generation (RAG) pipeline for diary memory retrieval. It covers:
- Embedding generation for diary chunks and query vectors
- Qdrant collection management and vector indexing
- Metadata storage alongside embeddings
- Semantic search using cosine similarity
- Hybrid retrieval combining lexical BM25 and vector similarity
- Configuration, performance tuning, and scalability guidance
- Troubleshooting vector storage and query performance

## Project Structure
The vector memory system spans configuration, models, services, and APIs:
- Configuration defines Qdrant endpoint, credentials, collection name, and vector dimension
- Models define the diary entity persisted in the database
- Services implement vector embedding, collection creation/upsert, and semantic search
- APIs orchestrate retrieval in the broader analysis workflow

```mermaid
graph TB
subgraph "Configuration"
CFG["config.py<br/>Qdrant settings"]
end
subgraph "Data Model"
DM["models/diary.py<br/>Diary entity"]
end
subgraph "Vector Memory Service"
VMS["services/qdrant_memory_service.py<br/>QdrantDiaryMemoryService"]
end
subgraph "RAG Service"
RAG["services/rag_service.py<br/>Lexical BM25 retrieval"]
end
subgraph "API Layer"
API["api/v1/diaries.py<br/>Endpoints"]
end
CFG --> VMS
DM --> VMS
VMS --> API
RAG --> API
```

**Diagram sources**
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)
- [diary.py:29-64](file://backend/app/models/diary.py#L29-L64)
- [qdrant_memory_service.py:45-188](file://backend/app/services/qdrant_memory_service.py#L45-L188)
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)
- [diaries.py:29-491](file://backend/app/api/v1/diaries.py#L29-L491)

**Section sources**
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)
- [diary.py:29-64](file://backend/app/models/diary.py#L29-L64)
- [qdrant_memory_service.py:45-188](file://backend/app/services/qdrant_memory_service.py#L45-L188)
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)
- [diaries.py:29-491](file://backend/app/api/v1/diaries.py#L29-L491)

## Core Components
- QdrantDiaryMemoryService: Manages Qdrant collection lifecycle, builds hash-based embeddings, synchronizes user diaries, and performs semantic search with cosine similarity.
- Diary model: Provides the source data for vectorization and metadata enrichment.
- Lexical BM25 service: Implements keyword-based retrieval with recency, importance, emotion, repetition, and people heuristics.
- Configuration: Centralizes Qdrant endpoint, API key, collection name, and vector dimension.
- Dependencies: httpx for HTTP requests to Qdrant.

Key responsibilities:
- Embedding generation: Tokenization and hashing-based vectorization with L2 normalization
- Collection management: Creation with Cosine distance and configured dimension
- Upsert: Bulk insertion of diary vectors with metadata payload
- Search: Vector similarity search constrained by user filter
- Hybrid retrieval: Lexical BM25 scoring combined with vector recall

**Section sources**
- [qdrant_memory_service.py:19-38](file://backend/app/services/qdrant_memory_service.py#L19-L38)
- [qdrant_memory_service.py:62-83](file://backend/app/services/qdrant_memory_service.py#L62-L83)
- [qdrant_memory_service.py:94-131](file://backend/app/services/qdrant_memory_service.py#L94-L131)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)
- [diary.py:29-64](file://backend/app/models/diary.py#L29-L64)
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)
- [requirements.txt:22](file://backend/requirements.txt#L22)

## Architecture Overview
The system integrates vector memory with lexical retrieval for robust diary search:
- Vector path: Diaries fetched from DB → Hash embedding → Qdrant upsert → Qdrant search → ranked results
- Lexical path: Diaries chunked and scored via BM25 with recency and metadata boosts
- Hybrid: Combine lexical and vector results with unified reranking

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Diaries API"
participant VMS as "QdrantDiaryMemoryService"
participant DB as "SQLAlchemy Session"
participant Q as "Qdrant"
Client->>API : "Retrieve context for query"
API->>VMS : "retrieve_context(user_id, query, top_k)"
VMS->>DB : "_fetch_user_diaries(user_id)"
DB-->>VMS : "Diaries"
VMS->>VMS : "Build hash embeddings"
VMS->>Q : "Upsert points (id, vector, payload)"
VMS->>Q : "Search(vector, filter=user_id)"
Q-->>VMS : "Hits with scores"
VMS-->>API : "Context hits"
API-->>Client : "Results"
```

**Diagram sources**
- [qdrant_memory_service.py:85-131](file://backend/app/services/qdrant_memory_service.py#L85-L131)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)
- [diaries.py:29-491](file://backend/app/api/v1/diaries.py#L29-L491)

## Detailed Component Analysis

### QdrantDiaryMemoryService
Implements:
- Tokenization for multilingual support
- Hash-based embedding with MD5-based indexing and L2 normalization
- Collection creation with Cosine distance and configured dimension
- Fetching user diaries and building points with metadata payload
- Upserting points and performing vector search with user filter

```mermaid
classDiagram
class QdrantDiaryMemoryService {
+url : string
+api_key : string
+collection : string
+dim : int
+enabled bool
+_headers() Dict
+_ensure_collection() void
+_fetch_user_diaries(db, user_id, limit) Sequence
+sync_user_diaries(db, user_id) int
+search(query, user_id, top_k) Dict[]
+retrieve_context(db, user_id, query, top_k) Dict[]
}
class Settings {
+qdrant_url : string
+qdrant_api_key : string
+qdrant_collection : string
+qdrant_vector_dim : int
}
QdrantDiaryMemoryService --> Settings : "reads"
```

**Diagram sources**
- [qdrant_memory_service.py:45-188](file://backend/app/services/qdrant_memory_service.py#L45-L188)
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)

Key behaviors:
- Embedding function: Tokenize text, compute MD5 hash per token, map to dimension via modulo, normalize
- Collection: Created with size equal to configured dimension and Cosine distance
- Payload: Stores user_id, diary_id, diary_date, title, snippet, emotion_tags, importance_score
- Search: Filters by user_id, returns score and payload fields

**Section sources**
- [qdrant_memory_service.py:19-38](file://backend/app/services/qdrant_memory_service.py#L19-L38)
- [qdrant_memory_service.py:62-83](file://backend/app/services/qdrant_memory_service.py#L62-L83)
- [qdrant_memory_service.py:94-131](file://backend/app/services/qdrant_memory_service.py#L94-L131)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)

### Lexical BM25 Retrieval (RAG Service)
Implements:
- Chunking diaries into overlapping segments
- Token frequency counting and document frequency computation
- BM25 scoring with idf and tf–idf-like normalization
- Recency, importance, emotion intensity, repetition, people hit, and source-type bonuses
- Deduplication via Jaccard similarity on token sets

```mermaid
flowchart TD
Start(["Start retrieve()"]) --> BuildChunks["Build chunks from diaries"]
BuildChunks --> Filter["Filter by source_types"]
Filter --> EmptyCheck{"Any chunks left?"}
EmptyCheck --> |No| ReturnEmpty["Return []"]
EmptyCheck --> |Yes| Tokenize["Tokenize query"]
Tokenize --> QueryEmpty{"Query tokens empty?"}
QueryEmpty --> |Yes| ReturnEmpty
QueryEmpty --> |No| ComputeStats["Compute N, avgdl, latest_date"]
ComputeStats --> DF["Compute df and theme_to_diaries"]
DF --> ScoreLoop["Score each chunk with BM25"]
ScoreLoop --> Heuristics["Apply recency/importance/emotion/repetition/people/source bonus"]
Heuristics --> Normalize["Normalize BM25 and combine weights"]
Normalize --> Sort["Sort by final score desc"]
Sort --> Limit["Take top_k"]
Limit --> Return["Return formatted results"]
```

**Diagram sources**
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)

**Section sources**
- [rag_service.py:147-360](file://backend/app/services/rag_service.py#L147-L360)

### Configuration and Environment
- Qdrant settings: URL, API key, collection name, vector dimension
- Example environment variables provided for local setup

**Section sources**
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)
- [.env.example:35-39](file://backend/.env.example#L35-L39)

## Dependency Analysis
External dependencies relevant to vector storage:
- httpx: HTTP client for Qdrant REST API calls
- SQLAlchemy: ORM for fetching diaries from the database

```mermaid
graph LR
VMS["QdrantDiaryMemoryService"] --> HTTPX["httpx"]
VMS --> SQLA["SQLAlchemy"]
API["Diaries API"] --> VMS
API --> RAG["RAG Service"]
```

**Diagram sources**
- [qdrant_memory_service.py:11-16](file://backend/app/services/qdrant_memory_service.py#L11-L16)
- [requirements.txt:22](file://backend/requirements.txt#L22)
- [diaries.py:23-27](file://backend/app/api/v1/diaries.py#L23-L27)

**Section sources**
- [requirements.txt:22](file://backend/requirements.txt#L22)
- [qdrant_memory_service.py:11-16](file://backend/app/services/qdrant_memory_service.py#L11-L16)
- [diaries.py:23-27](file://backend/app/api/v1/diaries.py#L23-L27)

## Performance Considerations
- Vector dimensionality
  - Current implementation uses a fixed dimension with a hashing-based sparse vector
  - Dimension affects memory footprint and search latency; ensure Qdrant vector size matches configuration
- Indexing and distance metric
  - Collection created with Cosine distance; suitable for normalized vectors
  - Normalization is applied in the embedding function
- Batch upsert and search limits
  - Upsert batches all user diaries; tune limit to balance freshness vs. cost
  - Search limit is capped to reduce payload size and latency
- Payload size
  - Payload includes snippet and metadata; keep snippet length reasonable to minimize storage and transfer costs
- Network timeouts
  - Async HTTP client with explicit timeouts; adjust based on network conditions
- Hybrid retrieval
  - Lexical BM25 provides precise lexical matches; combine with vector recall for robustness
- Scalability
  - Consider sharding by user_id or partitioning large datasets
  - Monitor Qdrant resource usage and scale replicas accordingly
  - For very large collections, consider approximate nearest neighbor (ANN) indices and optimized filters

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- Qdrant connection failures
  - Verify QDRANT_URL and QDRANT_API_KEY are set and reachable
  - Check network connectivity and firewall rules
- Collection creation errors
  - Ensure the collection does not conflict with existing schema; the service creates the collection with the configured dimension and Cosine distance
- Empty or low-quality embeddings
  - Ensure input text is not empty; the embedding function returns a zero vector for empty input
  - Confirm tokenization captures meaningful tokens for the target language
- Slow search performance
  - Reduce top_k limit and payload fields
  - Ensure user_id filter is indexed in Qdrant
  - Consider increasing Qdrant resources or scaling out
- Payload mismatch
  - Verify payload keys match those stored during upsert (user_id, diary_id, diary_date, title, snippet, emotion_tags, importance_score)
- Hybrid retrieval not combining results
  - Implement a post-processing step to merge BM25 and vector results with unified reranking

**Section sources**
- [qdrant_memory_service.py:62-83](file://backend/app/services/qdrant_memory_service.py#L62-L83)
- [qdrant_memory_service.py:94-131](file://backend/app/services/qdrant_memory_service.py#L94-L131)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)

## Conclusion
The vector storage system leverages a lightweight hashing-based embedding approach with Qdrant for efficient semantic search over user diaries. Combined with lexical BM25 retrieval, it provides robust, interpretable, and scalable memory-augmented search. Proper configuration of Qdrant settings, careful payload design, and thoughtful hybrid reranking enable high-quality recall and relevance for diary-based analysis.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Configuration Examples
- Qdrant settings
  - QDRANT_URL: Qdrant cluster endpoint
  - QDRANT_API_KEY: API key for authentication
  - QDRANT_COLLECTION: Name of the collection storing diary vectors
  - QDRANT_VECTOR_DIM: Vector dimension used for hashing and indexing
- Example environment variables
  - See the example environment file for defaults and placeholders

**Section sources**
- [config.py:72-88](file://backend/app/core/config.py#L72-L88)
- [.env.example:35-39](file://backend/.env.example#L35-L39)

### Embedding Generation Details
- Tokenization: Lowercase, extract English tokens (min 2 chars) and Chinese characters
- Hashing: MD5 per token; index into vector via modulo by dimension
- Normalization: L2-normalize resulting vector
- Query vectors: Built identically to diary vectors

**Section sources**
- [qdrant_memory_service.py:19-38](file://backend/app/services/qdrant_memory_service.py#L19-L38)

### Qdrant Collection Management
- Creation: Ensures collection exists with configured dimension and Cosine distance
- Upsert: Bulk inserts points with id, vector, and payload
- Search: Performs vector search with user filter and returns payload fields

**Section sources**
- [qdrant_memory_service.py:62-83](file://backend/app/services/qdrant_memory_service.py#L62-L83)
- [qdrant_memory_service.py:94-131](file://backend/app/services/qdrant_memory_service.py#L94-L131)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)

### Hybrid Retrieval Strategy
- Lexical BM25: Scores based on idf, tf normalization, recency, importance, emotion, repetition, people hit, and source bonus
- Vector recall: Semantic search with cosine similarity
- Unified rerank: Merge and reorder results for final presentation

**Section sources**
- [rag_service.py:210-317](file://backend/app/services/rag_service.py#L210-L317)
# Community Platform

<cite>
**Referenced Files in This Document**
- [community.py](file://backend/app/models/community.py)
- [community.py](file://backend/app/schemas/community.py)
- [community_service.py](file://backend/app/services/community_service.py)
- [community.py](file://backend/app/api/v1/community.py)
- [AnonymousAvatar.tsx](file://frontend/src/components/community/AnonymousAvatar.tsx)
- [CreatePostPage.tsx](file://frontend/src/pages/community/CreatePostPage.tsx)
- [CommunityPage.tsx](file://frontend/src/pages/community/CommunityPage.tsx)
- [CollectionsPage.tsx](file://frontend/src/pages/community/CollectionsPage.tsx)
- [database.py](file://backend/app/models/database.py)
- [qdrant_memory_service.py](file://backend/app/services/qdrant_memory_service.py)
- [community.service.ts](file://frontend/src/services/community.service.ts)
- [security.py](file://backend/app/core/security.py)
- [community.md](file://docs/功能文档/社区.md)
- [PRD-产品需求文档.md](file://PRD-产品需求文档.md)
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
This document describes the Community Platform feature of the application, focusing on the anonymous posting system, content moderation and user safety measures, content discovery via semantic search and popularity algorithms, user interactions (likes, comments, sharing), collections/bookmarks, post lifecycle, anonymous avatar and identity management, backend service architecture, database schema, and frontend component hierarchy. It also outlines community guidelines, content policy enforcement, and spam prevention mechanisms grounded in the repository’s implementation.

## Project Structure
The Community Platform spans backend services and frontend pages:
- Backend: FastAPI router, SQLAlchemy models, Pydantic schemas, and a dedicated service layer for community operations.
- Frontend: Pages for creating posts, browsing community feeds, viewing post details, managing collections, and rendering anonymous avatars.

```mermaid
graph TB
subgraph "Backend"
R["FastAPI Router<br/>community.py"]
S["Community Service<br/>community_service.py"]
M["Models<br/>community.py"]
U["User Model<br/>database.py"]
Sec["Security Utilities<br/>security.py"]
end
subgraph "Frontend"
CS["Community Service<br/>community.service.ts"]
CP["Community Page<br/>CommunityPage.tsx"]
CFP["Create Post Page<br/>CreatePostPage.tsx"]
COLP["Collections Page<br/>CollectionsPage.tsx"]
AA["Anonymous Avatar<br/>AnonymousAvatar.tsx"]
end
R --> S
S --> M
S --> U
CS --> R
CP --> CS
CFP --> CS
COLP --> CS
CP --> AA
```

**Diagram sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [community.py:1-176](file://backend/app/models/community.py#L1-L176)
- [database.py:1-70](file://backend/app/models/database.py#L1-L70)
- [security.py:1-92](file://backend/app/core/security.py#L1-L92)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)
- [CommunityPage.tsx:1-358](file://frontend/src/pages/community/CommunityPage.tsx#L1-L358)
- [CreatePostPage.tsx:1-210](file://frontend/src/pages/community/CreatePostPage.tsx#L1-L210)
- [CollectionsPage.tsx:1-137](file://frontend/src/pages/community/CollectionsPage.tsx#L1-L137)
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)

**Section sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [community.py:1-176](file://backend/app/models/community.py#L1-L176)
- [database.py:1-70](file://backend/app/models/database.py#L1-L70)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)
- [CommunityPage.tsx:1-358](file://frontend/src/pages/community/CommunityPage.tsx#L1-L358)
- [CreatePostPage.tsx:1-210](file://frontend/src/pages/community/CreatePostPage.tsx#L1-L210)
- [CollectionsPage.tsx:1-137](file://frontend/src/pages/community/CollectionsPage.tsx#L1-L137)
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)

## Core Components
- Backend API router exposes endpoints for posts, comments, likes, collections, image uploads, and history.
- Community service encapsulates business logic: CRUD, counts, toggles, pagination, and response building.
- SQLAlchemy models define posts, comments, likes, collects, views, and user relations.
- Pydantic schemas validate and serialize request/response payloads.
- Frontend pages orchestrate user actions and render community experiences, including anonymous avatars.

Key capabilities:
- Anonymous posting with immutable content for anonymous posts.
- Interaction counters and toggles for likes and collections.
- Comment threads with nested replies.
- Browse history tracking per user-post pair.
- Image upload endpoint with size/type constraints.

**Section sources**
- [community.py:39-156](file://backend/app/api/v1/community.py#L39-L156)
- [community_service.py:36-144](file://backend/app/services/community_service.py#L36-L144)
- [community.py:23-176](file://backend/app/models/community.py#L23-L176)
- [community.py:12-124](file://backend/app/schemas/community.py#L12-L124)
- [CreatePostPage.tsx:53-78](file://frontend/src/pages/community/CreatePostPage.tsx#L53-L78)
- [CommunityPage.tsx:71-101](file://frontend/src/pages/community/CommunityPage.tsx#L71-L101)

## Architecture Overview
The backend follows a layered architecture:
- API layer validates requests and delegates to the service layer.
- Service layer performs database operations and builds enriched responses.
- Models define persistence and relationships.
- Security utilities manage authentication tokens.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "FastAPI Router"
participant SVC as "CommunityService"
participant DB as "SQLAlchemy ORM"
FE->>API : "POST /community/posts"
API->>SVC : "create_post(user_id, circle_id, content, images, is_anonymous)"
SVC->>DB : "insert CommunityPost"
DB-->>SVC : "persisted post"
SVC-->>API : "post entity"
API-->>FE : "PostResponse"
```

**Diagram sources**
- [community.py:39-56](file://backend/app/api/v1/community.py#L39-L56)
- [community_service.py:36-57](file://backend/app/services/community_service.py#L36-L57)
- [community.py:23-54](file://backend/app/models/community.py#L23-L54)

**Section sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [database.py:13-44](file://backend/app/models/database.py#L13-L44)

## Detailed Component Analysis

### Anonymous Posting System
- Users can opt into anonymous posting during creation.
- Anonymous posts cannot be edited afterward.
- Author metadata is omitted in responses for anonymous posts.
- Anonymous avatar UI component renders a stylized placeholder with an eye-closed icon fallback.

```mermaid
flowchart TD
Start(["Create Post"]) --> CheckCircle["Validate circle_id"]
CheckCircle --> BuildPost["Build CommunityPost (is_anonymous)"]
BuildPost --> Persist["Persist to DB"]
Persist --> Response["Build PostResponse (hide author if anonymous)"]
Response --> End(["Done"])
```

**Diagram sources**
- [community_service.py:36-57](file://backend/app/services/community_service.py#L36-L57)
- [community.py:23-54](file://backend/app/models/community.py#L23-L54)
- [community.py:33-47](file://backend/app/schemas/community.py#L33-L47)

**Section sources**
- [community.py:39-56](file://backend/app/api/v1/community.py#L39-L56)
- [community_service.py:119-135](file://backend/app/services/community_service.py#L119-L135)
- [CreatePostPage.tsx:199-205](file://frontend/src/pages/community/CreatePostPage.tsx#L199-L205)
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)

### Content Discovery Mechanism
- Listing posts supports pagination and optional circle filtering.
- Comments retrieval orders by creation time.
- Browse history aggregates last view per post per user.
- Semantic search capability exists for diary memory via Qdrant; while not directly used for community posts, the pattern demonstrates semantic embedding and retrieval.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "GET /community/posts"
participant SVC as "CommunityService"
participant DB as "SQLAlchemy ORM"
FE->>API : "list_posts(circle_id?, page, page_size)"
API->>SVC : "list_posts(...)"
SVC->>DB : "select count + paginated posts"
DB-->>SVC : "posts + total"
SVC-->>API : "posts, total"
API-->>FE : "PostListResponse"
```

**Diagram sources**
- [community.py:59-79](file://backend/app/api/v1/community.py#L59-L79)
- [community_service.py:68-93](file://backend/app/services/community_service.py#L68-L93)

**Section sources**
- [community.py:59-79](file://backend/app/api/v1/community.py#L59-L79)
- [community_service.py:68-93](file://backend/app/services/community_service.py#L68-L93)
- [qdrant_memory_service.py:133-173](file://backend/app/services/qdrant_memory_service.py#L133-L173)

### User Interactions: Likes, Comments, Sharing
- Toggle like/unlike updates counters atomically.
- Toggle collect/uncollect updates counters atomically.
- Create and list comments; nested replies supported via parent_id.
- Sharing is not implemented in the current code; only likes, comments, and collections are present.

```mermaid
sequenceDiagram
participant FE as "Frontend"
participant API as "POST /community/posts/{id}/like"
participant SVC as "CommunityService"
participant DB as "SQLAlchemy ORM"
FE->>API : "toggle_like(post_id)"
API->>SVC : "toggle_like(post_id, user_id)"
SVC->>DB : "upsert PostLike + update like_count"
DB-->>SVC : "commit"
SVC-->>API : "liked : bool"
API-->>FE : "{liked}"
```

**Diagram sources**
- [community.py:245-256](file://backend/app/api/v1/community.py#L245-L256)
- [community_service.py:213-235](file://backend/app/services/community_service.py#L213-L235)

**Section sources**
- [community.py:245-272](file://backend/app/api/v1/community.py#L245-L272)
- [community_service.py:213-270](file://backend/app/services/community_service.py#L213-L270)
- [community.py:193-227](file://backend/app/api/v1/community.py#L193-L227)
- [community_service.py:148-209](file://backend/app/services/community_service.py#L148-L209)

### Collections and Bookmark System
- Users can toggle collection state for posts.
- Dedicated endpoint lists collected posts with pagination.
- Collections page renders curated list with interaction stats.

```mermaid
sequenceDiagram
participant FE as "CollectionsPage"
participant API as "GET /community/collections"
participant SVC as "CommunityService"
participant DB as "SQLAlchemy ORM"
FE->>API : "list_collected_posts(user_id, page, page_size)"
API->>SVC : "list_collected_posts(...)"
SVC->>DB : "join PostCollect + filter deleted"
DB-->>SVC : "posts"
SVC-->>API : "posts, total"
API-->>FE : "PostListResponse"
```

**Diagram sources**
- [community.py:275-294](file://backend/app/api/v1/community.py#L275-L294)
- [community_service.py:281-305](file://backend/app/services/community_service.py#L281-L305)
- [CollectionsPage.tsx:30-40](file://frontend/src/pages/community/CollectionsPage.tsx#L30-L40)

**Section sources**
- [community.py:275-294](file://backend/app/api/v1/community.py#L275-L294)
- [community_service.py:281-305](file://backend/app/services/community_service.py#L281-L305)
- [CollectionsPage.tsx:78-121](file://frontend/src/pages/community/CollectionsPage.tsx#L78-L121)

### Post Lifecycle: Creation to Moderation and Archiving
- Creation: Validate circle, persist post, return enriched response.
- Editing: Allowed only for non-anonymous posts.
- Deletion: Soft-delete flag applied.
- Listing: Filters out deleted posts; supports pagination and circle filtering.
- Moderation: No explicit admin endpoints observed; deletion acts as soft moderation.

```mermaid
flowchart TD
C["Create Post"] --> E["Edit Post?"]
E --> |No| L["List Posts (exclude deleted)"]
E --> |Yes & not anonymous| U["Update Content/Images"]
E --> |Yes & anonymous| Err["Reject Edit"]
U --> L
L --> D["Delete Post (soft)"]
D --> L
```

**Diagram sources**
- [community_service.py:36-57](file://backend/app/services/community_service.py#L36-L57)
- [community_service.py:119-135](file://backend/app/services/community_service.py#L119-L135)
- [community_service.py:137-144](file://backend/app/services/community_service.py#L137-L144)
- [community_service.py:68-93](file://backend/app/services/community_service.py#L68-L93)

**Section sources**
- [community_service.py:36-144](file://backend/app/services/community_service.py#L36-L144)
- [community.py:122-155](file://backend/app/api/v1/community.py#L122-L155)

### Anonymous Avatar and Identity Management
- Anonymous posts hide author identity in responses.
- Anonymous avatar component renders a gradient-filled circle with either a fallback icon or a default image.
- Non-anonymous authors display username initials or avatar when available.

```mermaid
classDiagram
class AnonymousAvatar {
+size : "sm|md|lg"
+render()
}
class PostResponse {
+is_anonymous : bool
+author : PostAuthor?
}
class PostAuthor {
+id : int
+username : string?
+avatar_url : string?
}
PostResponse --> PostAuthor : "optional"
```

**Diagram sources**
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)
- [community.py:26-47](file://backend/app/schemas/community.py#L26-L47)

**Section sources**
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)
- [community.py:26-47](file://backend/app/schemas/community.py#L26-L47)
- [CommunityPage.tsx:249-274](file://frontend/src/pages/community/CommunityPage.tsx#L249-L274)

### Backend Service Architecture
- API router depends on current active user and database session.
- Service layer centralizes queries, mutations, and response enrichment.
- Security utilities provide JWT encoding/decoding and password hashing.

```mermaid
graph LR
API["API Router"] --> SVC["CommunityService"]
SVC --> MODELS["SQLAlchemy Models"]
SVC --> USER["User Model"]
API --> SEC["Security Utils"]
```

**Diagram sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [database.py:13-44](file://backend/app/models/database.py#L13-L44)
- [security.py:1-92](file://backend/app/core/security.py#L1-L92)

**Section sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [security.py:1-92](file://backend/app/core/security.py#L1-L92)

### Database Schema for Posts and Interactions
- CommunityPost: primary keys, foreign key to users, circle_id, content, images, anonymous flag, counters, soft-delete, timestamps.
- PostComment: nested reply support via parent_id, anonymous flag, soft-delete.
- PostLike: unique constraint on user-post pair.
- PostCollect: unique constraint on user-post pair.
- PostView: per-user-per-post view records.
- User: base user model with profile fields.

```mermaid
erDiagram
USERS {
int id PK
string email UK
string password_hash
string username
string avatar_url
boolean is_active
boolean is_verified
timestamp created_at
timestamp updated_at
}
COMMUNITY_POSTS {
int id PK
int user_id FK
string circle_id
text content
json images
boolean is_anonymous
int like_count
int comment_count
int collect_count
boolean is_deleted
timestamp created_at
timestamp updated_at
}
POST_COMMENTS {
int id PK
int post_id FK
int user_id FK
int parent_id FK
text content
boolean is_anonymous
boolean is_deleted
timestamp created_at
}
POST_LIKES {
int id PK
int user_id FK
int post_id FK
timestamp created_at
}
POST_COLLECTS {
int id PK
int user_id FK
int post_id FK
timestamp created_at
}
POST_VIEWS {
int id PK
int user_id FK
int post_id FK
timestamp created_at
}
USERS ||--o{ COMMUNITY_POSTS : "creates"
USERS ||--o{ POST_COMMENTS : "writes"
USERS ||--o{ POST_LIKES : "toggles"
USERS ||--o{ POST_COLLECTS : "curates"
USERS ||--o{ POST_VIEWS : "views"
COMMUNITY_POSTS ||--o{ POST_COMMENTS : "has"
COMMUNITY_POSTS ||--o{ POST_LIKES : "liked_by"
COMMUNITY_POSTS ||--o{ POST_COLLECTS : "saved_by"
COMMUNITY_POSTS ||--o{ POST_VIEWS : "viewed_by"
```

**Diagram sources**
- [community.py:23-176](file://backend/app/models/community.py#L23-L176)
- [database.py:13-44](file://backend/app/models/database.py#L13-L44)

**Section sources**
- [community.py:1-176](file://backend/app/models/community.py#L1-L176)
- [database.py:1-70](file://backend/app/models/database.py#L1-L70)

### Frontend Component Hierarchy
- CommunityPage: fetches circles and posts, handles likes/collects, renders anonymous/non-anonymous author blocks, and pagination.
- CreatePostPage: selects circle, manages images, toggles anonymity, and submits posts.
- CollectionsPage: lists collected posts with uncollect action.
- AnonymousAvatar: reusable component for anonymous identities.

```mermaid
graph TB
CP["CommunityPage.tsx"] --> CS["community.service.ts"]
CFP["CreatePostPage.tsx"] --> CS
COLP["CollectionsPage.tsx"] --> CS
CP --> AA["AnonymousAvatar.tsx"]
CFP --> AA
```

**Diagram sources**
- [CommunityPage.tsx:1-358](file://frontend/src/pages/community/CommunityPage.tsx#L1-L358)
- [CreatePostPage.tsx:1-210](file://frontend/src/pages/community/CreatePostPage.tsx#L1-L210)
- [CollectionsPage.tsx:1-137](file://frontend/src/pages/community/CollectionsPage.tsx#L1-L137)
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)

**Section sources**
- [CommunityPage.tsx:1-358](file://frontend/src/pages/community/CommunityPage.tsx#L1-L358)
- [CreatePostPage.tsx:1-210](file://frontend/src/pages/community/CreatePostPage.tsx#L1-L210)
- [CollectionsPage.tsx:1-137](file://frontend/src/pages/community/CollectionsPage.tsx#L1-L137)
- [AnonymousAvatar.tsx:1-46](file://frontend/src/components/community/AnonymousAvatar.tsx#L1-L46)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)

## Dependency Analysis
- API depends on service layer and current user/session.
- Service depends on models and user model for author resolution.
- Frontend service depends on API endpoints.
- Security utilities underpin authentication.

```mermaid
graph LR
API["API Router"] --> SVC["CommunityService"]
SVC --> MODELS["Models"]
SVC --> USER["User"]
FECS["community.service.ts"] --> API
FECP["CommunityPage.tsx"] --> FECS
FECFP["CreatePostPage.tsx"] --> FECS
FECOLP["CollectionsPage.tsx"] --> FECS
```

**Diagram sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [database.py:13-44](file://backend/app/models/database.py#L13-L44)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)
- [CommunityPage.tsx:1-358](file://frontend/src/pages/community/CommunityPage.tsx#L1-L358)
- [CreatePostPage.tsx:1-210](file://frontend/src/pages/community/CreatePostPage.tsx#L1-L210)
- [CollectionsPage.tsx:1-137](file://frontend/src/pages/community/CollectionsPage.tsx#L1-L137)

**Section sources**
- [community.py:1-324](file://backend/app/api/v1/community.py#L1-L324)
- [community_service.py:1-415](file://backend/app/services/community_service.py#L1-L415)
- [database.py:1-70](file://backend/app/models/database.py#L1-L70)
- [community.service.ts:1-180](file://frontend/src/services/community.service.ts#L1-L180)

## Performance Considerations
- Pagination limits: endpoints cap page_size to prevent heavy loads.
- Indexes on foreign keys and filters (user_id, post_id, circle_id) improve query performance.
- Count queries precede paginated selects to compute total pages efficiently.
- Image upload constraints (type and size) reduce storage overhead and downstream processing costs.

Recommendations:
- Add database indexes on created_at for time-based sorting.
- Consider caching popular posts or frequently accessed counts.
- Batch operations for view history aggregation.

**Section sources**
- [community.py:60-63](file://backend/app/api/v1/community.py#L60-L63)
- [community_service.py:78-93](file://backend/app/services/community_service.py#L78-L93)

## Troubleshooting Guide
Common issues and remedies:
- Invalid circle_id during post creation: ensure circle_id matches predefined values.
- Attempting to edit anonymous posts: blocked by service logic.
- Not found errors for posts/comments: verify ownership and soft-deleted state.
- Image upload failures: check allowed types and size limits.

Operational tips:
- Inspect HTTP status codes returned by endpoints.
- Verify JWT-based authentication for protected routes.
- Confirm database constraints (unique likes/collects) to avoid duplicates.

**Section sources**
- [community_service.py:43-45](file://backend/app/services/community_service.py#L43-L45)
- [community_service.py:127-128](file://backend/app/services/community_service.py#L127-L128)
- [community.py:166-178](file://backend/app/api/v1/community.py#L166-L178)
- [security.py:73-91](file://backend/app/core/security.py#L73-L91)

## Conclusion
The Community Platform integrates anonymous posting, robust interactions, curated collections, and privacy-conscious identity management. Its backend employs a clean service-layer architecture with strong typing via Pydantic and SQLAlchemy ORM. Frontend components deliver a cohesive user experience, including anonymous avatars and intuitive post interactions. While explicit moderation endpoints are not present, soft deletion and strict anonymity safeguards align with community guidelines emphasizing safety and respect.

## Appendices

### Community Guidelines and Policy Enforcement
- Anonymous posts cannot be edited to protect identities and reduce malicious edits.
- Anonymous interactions remain anonymous.
- Community is organized into emotional circles to avoid open-feed chaos.
- Visual identity for anonymous users avoids cold defaults; circles use emotionally resonant colors.

**Section sources**
- [community.md:10-39](file://docs/功能文档/社区.md#L10-L39)
- [community_service.py:127-128](file://backend/app/services/community_service.py#L127-L128)

### Spam Prevention Mechanisms
- Content length constraints and image upload limits reduce low-effort spam.
- Soft deletion allows removal without permanent loss.
- Anonymous-only immutable posts reduce edit-based abuse.

**Section sources**
- [community.py:14-17](file://backend/app/schemas/community.py#L14-L17)
- [community.py:173-178](file://backend/app/api/v1/community.py#L173-L178)
- [community_service.py:137-144](file://backend/app/services/community_service.py#L137-L144)
# Agent Orchestrator

<cite>
**Referenced Files in This Document**
- [orchestrator.py](file://backend/app/agents/orchestrator.py)
- [state.py](file://backend/app/agents/state.py)
- [agent_impl.py](file://backend/app/agents/agent_impl.py)
- [prompts.py](file://backend/app/agents/prompts.py)
- [llm.py](file://backend/app/agents/llm.py)
- [ai.py](file://backend/app/api/v1/ai.py)
- [test_ai_agents.py](file://backend/test_ai_agents.py)
- [config.py](file://backend/app/core/config.py)
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
This document provides comprehensive documentation for the AgentOrchestrator class, the central coordinator of the multi-agent AI system. It explains the seven-step analysis pipeline from context collection to therapeutic response generation, details the initialization process, state management through AnalysisState, error handling mechanisms, and the workflow diagram showing agent interactions and state transitions. It also documents the format_result method and its output structure, provides examples of the complete analysis flow, and explains how the orchestrator maintains context across multiple agent interactions.

## Project Structure
The orchestrator resides in the backend agents module and coordinates four specialized agents:
- ContextCollectorAgent (Agent 0)
- TimelineManagerAgent (Agent A)
- SatirTherapistAgent (Agent B) with sub-steps B1–B4
- SocialContentCreatorAgent (Agent C)

```mermaid
graph TB
subgraph "Agents Module"
O["AgentOrchestrator<br/>orchestrator.py"]
S["AnalysisState<br/>state.py"]
A0["ContextCollectorAgent<br/>agent_impl.py"]
AA["TimelineManagerAgent<br/>agent_impl.py"]
AB["SatirTherapistAgent<br/>agent_impl.py"]
AC["SocialContentCreatorAgent<br/>agent_impl.py"]
P["Prompts<br/>prompts.py"]
L["LLM Adapter<br/>llm.py"]
end
O --> A0
O --> AA
O --> AB
O --> AC
A0 --> P
AA --> P
AB --> P
AC --> P
A0 --> L
AA --> L
AB --> L
AC --> L
O --> S
```

**Diagram sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [prompts.py:7-244](file://backend/app/agents/prompts.py#L7-L244)
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)

**Section sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [prompts.py:7-244](file://backend/app/agents/prompts.py#L7-L244)
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)

## Core Components
- AgentOrchestrator: Central coordinator that initializes agents and orchestrates the seven-step analysis pipeline.
- AnalysisState: Typed dictionary representing the shared state across agents.
- Agent implementations: Four specialized agents implementing distinct steps in the pipeline.
- Prompts: Prompt templates for each agent’s tasks.
- LLM adapter: Simplified OpenAI-compatible interface backed by DeepSeek API.

Key responsibilities:
- Initialization: Creates instances of all agents.
- Orchestration: Executes steps sequentially with explicit state transitions.
- Error handling: Catches exceptions, records errors, and returns partial results.
- Output formatting: Converts internal state to a standardized result structure.

**Section sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)
- [prompts.py:7-244](file://backend/app/agents/prompts.py#L7-L244)
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)

## Architecture Overview
The orchestrator coordinates a linear pipeline with explicit state transitions. Each agent performs a focused task and updates the shared AnalysisState. The orchestrator manages timing, error propagation, and final result formatting.

```mermaid
sequenceDiagram
participant API as "API Endpoint<br/>ai.py"
participant Orchestrator as "AgentOrchestrator<br/>orchestrator.py"
participant CCA as "ContextCollectorAgent<br/>agent_impl.py"
participant TMA as "TimelineManagerAgent<br/>agent_impl.py"
participant STA as "SatirTherapistAgent<br/>agent_impl.py"
participant SCA as "SocialContentCreatorAgent<br/>agent_impl.py"
API->>Orchestrator : analyze_diary(...)
Orchestrator->>Orchestrator : initialize AnalysisState
Orchestrator->>CCAs : collect(state, user_profile, timeline_context)
Orchestrator->>TMA : extract_event(state)
Orchestrator->>STA : analyze_emotion_layer(state)
Orchestrator->>STA : analyze_belief_layer(state)
Orchestrator->>STA : analyze_existence_layer(state)
Orchestrator->>STA : generate_response(state)
Orchestrator->>SCA : generate_posts(state, user_profile)
Orchestrator->>Orchestrator : compute processing_time
Orchestrator-->>API : state
API->>Orchestrator : format_result(state)
Orchestrator-->>API : formatted result
```

**Diagram sources**
- [orchestrator.py:27-131](file://backend/app/agents/orchestrator.py#L27-L131)
- [agent_impl.py:100-141](file://backend/app/agents/agent_impl.py#L100-L141)
- [agent_impl.py:152-202](file://backend/app/agents/agent_impl.py#L152-L202)
- [agent_impl.py:214-393](file://backend/app/agents/agent_impl.py#L214-L393)
- [agent_impl.py:404-483](file://backend/app/agents/agent_impl.py#L404-L483)
- [ai.py:521-532](file://backend/app/api/v1/ai.py#L521-L532)

## Detailed Component Analysis

### AgentOrchestrator
Responsibilities:
- Initializes agents: ContextCollectorAgent, TimelineManagerAgent, SatirTherapistAgent, SocialContentCreatorAgent.
- Executes the seven-step pipeline with explicit state transitions.
- Handles exceptions and populates error metadata.
- Computes total processing time.
- Formats final result via format_result.

Initialization:
- Creates agent instances in __init__.
- No external dependencies beyond agent_impl imports.

Pipeline steps:
- Step 0: context_collection
- Step 1: timeline_extraction
- Steps 2.1–2.4: satir_analysis phases (emotion, belief/cognitive, existence, response)
- Step 3: social_content_generation

Error handling:
- Wraps the entire pipeline in a try-except block.
- On failure, sets error field and returns state with partial results.

Output formatting:
- format_result converts internal state to a structured dictionary suitable for API responses.

**Section sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)

#### Class Diagram
```mermaid
classDiagram
class AgentOrchestrator {
+analyze_diary(user_id, diary_id, diary_content, diary_date, user_profile, timeline_context) Dict
+format_result(state) Dict
}
class ContextCollectorAgent
class TimelineManagerAgent
class SatirTherapistAgent
class SocialContentCreatorAgent
AgentOrchestrator --> ContextCollectorAgent : "uses"
AgentOrchestrator --> TimelineManagerAgent : "uses"
AgentOrchestrator --> SatirTherapistAgent : "uses"
AgentOrchestrator --> SocialContentCreatorAgent : "uses"
```

**Diagram sources**
- [orchestrator.py:18-176](file://backend/app/agents/orchestrator.py#L18-L176)
- [agent_impl.py:92-484](file://backend/app/agents/agent_impl.py#L92-L484)

### AnalysisState
Typed dictionary defining the shared state across agents. Keys include:
- Inputs: user_id, diary_id, diary_content, diary_date, user_profile, timeline_context, related_memories.
- Intermediate outputs: behavior_layer, emotion_layer, cognitive_layer, belief_layer, core_self_layer, timeline_event, social_posts.
- Final outputs: therapeutic_response.
- Metadata: processing_time, error, current_step, agent_runs.

This structure ensures predictable data flow and simplifies debugging and persistence.

**Section sources**
- [state.py:10-45](file://backend/app/agents/state.py#L10-L45)

### Agent Implementations

#### ContextCollectorAgent (Agent 0)
- Purpose: Collect contextual information from user profile and timeline context.
- Input: AnalysisState, user_profile, timeline_context.
- Output: Updates AnalysisState with collected context.
- Error handling: Logs and continues; preserves original inputs.

Key behaviors:
- Builds a prompt using CONTEXT_COLLECTOR_PROMPT.
- Calls LLM with JSON response format.
- Parses JSON payload robustly.

**Section sources**
- [agent_impl.py:92-142](file://backend/app/agents/agent_impl.py#L92-L142)
- [prompts.py:9-28](file://backend/app/agents/prompts.py#L9-L28)

#### TimelineManagerAgent (Agent A)
- Purpose: Extract a structured timeline event from diary content.
- Input: AnalysisState.
- Output: timeline_event in AnalysisState.
- Error handling: Falls back to default event on failure.

Key behaviors:
- Uses TIMELINE_EXTRACTOR_PROMPT.
- Constructs event with summary, emotion tag, importance score, type, and related entities.
- Graceful degradation to default event.

**Section sources**
- [agent_impl.py:144-202](file://backend/app/agents/agent_impl.py#L144-L202)
- [prompts.py:33-57](file://backend/app/agents/prompts.py#L33-L57)

#### SatirTherapistAgent (Agent B)
- Purpose: Perform five-layer analysis using the Satir Iceberg Model.
- Sub-steps:
  - B1: analyze_emotion_layer
  - B2: analyze_belief_layer
  - B3: analyze_existence_layer
  - B4: generate_response

Key behaviors:
- Uses separate LLMs for analytical tasks and creative response generation.
- Each sub-step builds on previous layers.
- Robust JSON parsing and fallbacks on failures.

**Section sources**
- [agent_impl.py:205-393](file://backend/app/agents/agent_impl.py#L205-L393)
- [prompts.py:62-163](file://backend/app/agents/prompts.py#L62-L163)

#### SocialContentCreatorAgent (Agent C)
- Purpose: Generate social media posts based on user profile and event context.
- Input: AnalysisState, user_profile.
- Output: social_posts in AnalysisState.
- Error handling: Generates simple fallback posts on failure.

Key behaviors:
- Uses SOCIAL_POST_CREATOR_PROMPT.
- Attempts multiple strategies to parse JSON from LLM output.
- Fallback to two simple posts if parsing fails.

**Section sources**
- [agent_impl.py:396-483](file://backend/app/agents/agent_impl.py#L396-L483)
- [prompts.py:168-208](file://backend/app/agents/prompts.py#L168-L208)

### Prompts
Each agent has a dedicated prompt template defining:
- Task description
- Input context formatting
- Output schema expectations
- Style and tone requirements

Examples:
- CONTEXT_COLLECTOR_PROMPT: Summarizes current mood, concerns, and hopes.
- TIMELINE_EXTRACTOR_PROMPT: Extracts event summary, emotion tag, importance, type, and entities.
- SATIR_EMOTION_PROMPT: Analyzes surface and underlying emotions.
- SATIR_BELIEF_PROMPT: Identifies irrational beliefs, automatic thoughts, core beliefs, and life rules.
- SATIR_EXISTENCE_PROMPT: Discovers yearnings, life energy, deepest desire, and existence insight.
- SATIR_RESPONDER_PROMPT: Generates a warm, therapeutic response.
- SOCIAL_POST_CREATOR_PROMPT: Produces multiple versions of social posts.

**Section sources**
- [prompts.py:7-244](file://backend/app/agents/prompts.py#L7-L244)

### LLM Adapter
The system uses a simplified OpenAI-compatible interface backed by DeepSeek API:
- DeepSeekClient: Handles HTTP requests to DeepSeek chat completions.
- ChatOpenAI: LangChain-compatible wrapper around DeepSeekClient.
- get_llm/get_analytical_llm/get_creative_llm: Factory functions returning configured LLM instances.

Integration:
- Agents call ChatOpenAI.ainvoke with system and human messages.
- Response format support for JSON output.

**Section sources**
- [llm.py:13-220](file://backend/app/agents/llm.py#L13-L220)
- [config.py:62-70](file://backend/app/core/config.py#L62-L70)

### Workflow Diagram with State Transitions
```mermaid
flowchart TD
Start(["Start analyze_diary"]) --> Init["Initialize AnalysisState"]
Init --> Step0["Step 0: Context Collection<br/>Agent 0"]
Step0 --> Step1["Step 1: Timeline Extraction<br/>Agent A"]
Step1 --> Step2a["Step 2.1: Emotion Layer<br/>Agent B1"]
Step2a --> Step2b["Step 2.2: Belief/Cognitive Layers<br/>Agent B2"]
Step2b --> Step2c["Step 2.3: Existence Layer<br/>Agent B3"]
Step2c --> Step2d["Step 2.4: Therapeutic Response<br/>Agent B4"]
Step2d --> Step3["Step 3: Social Content Generation<br/>Agent C"]
Step3 --> Time["Compute processing_time"]
Time --> End(["Return state"])
Error(["Exception"]) --> SetErr["Set error in state"]
SetErr --> Time
```

**Diagram sources**
- [orchestrator.py:27-131](file://backend/app/agents/orchestrator.py#L27-L131)

## Dependency Analysis
- AgentOrchestrator depends on:
  - agent_impl.py for agent implementations
  - state.py for AnalysisState type
- Agent implementations depend on:
  - prompts.py for templates
  - llm.py for LLM interface
- API endpoint (ai.py) depends on AgentOrchestrator for orchestration and result formatting.

Potential circular dependencies:
- None detected among orchestrator, agents, and state.

External dependencies:
- DeepSeek API via llm.py
- LangChain-compatible interface abstraction

**Section sources**
- [orchestrator.py:9-15](file://backend/app/agents/orchestrator.py#L9-L15)
- [agent_impl.py:12-22](file://backend/app/agents/agent_impl.py#L12-L22)
- [ai.py:21, 521-532:21-532](file://backend/app/api/v1/ai.py#L21-L532)

## Performance Considerations
- Asynchronous execution: All agent methods are async, enabling concurrent I/O-bound LLM calls.
- Temperature tuning: Different LLM configurations for analytical vs. creative tasks.
- JSON parsing robustness: Multiple strategies to extract structured output from LLM responses.
- Error handling: Graceful fallbacks prevent pipeline termination and preserve partial results.
- Timing: Total processing time computed at the end for observability.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common issues and resolutions:
- LLM response parsing failures:
  - Cause: Non-JSON or malformed responses.
  - Resolution: The system attempts multiple parsing strategies; falls back to defaults.
- Agent failures:
  - Cause: Network errors, timeouts, or invalid prompts.
  - Resolution: Each agent logs errors and continues; state.error captures the error message.
- Missing API keys:
  - Cause: DeepSeek API key not configured.
  - Resolution: Configure settings.deepseek_api_key and settings.deepseek_base_url.
- JSON decode errors:
  - Cause: Malformed JSON in agent outputs.
  - Resolution: _parse_json_payload handles various formats; fallbacks exist in agents.

Operational tips:
- Monitor processing_time and agent_runs for performance insights.
- Inspect metadata.workflow and workflow_detail for step-by-step breakdown.
- Use format_result to standardize outputs for clients.

**Section sources**
- [agent_impl.py:25-68](file://backend/app/agents/agent_impl.py#L25-L68)
- [agent_impl.py:136-141](file://backend/app/agents/agent_impl.py#L136-L141)
- [agent_impl.py:191-202](file://backend/app/agents/agent_impl.py#L191-L202)
- [agent_impl.py:293-298](file://backend/app/agents/agent_impl.py#L293-L298)
- [agent_impl.py:337-346](file://backend/app/agents/agent_impl.py#L337-L346)
- [agent_impl.py:388-393](file://backend/app/agents/agent_impl.py#L388-L393)
- [agent_impl.py:465-483](file://backend/app/agents/agent_impl.py#L465-L483)
- [orchestrator.py:121-130](file://backend/app/agents/orchestrator.py#L121-L130)
- [config.py:62-70](file://backend/app/core/config.py#L62-L70)

## Conclusion
The AgentOrchestrator provides a robust, modular framework for multi-agent analysis. Its seven-step pipeline, typed state management, and comprehensive error handling enable reliable processing of diary content into actionable insights and social content. The design emphasizes resilience, observability, and extensibility, making it suitable for iterative improvements and integration with broader systems.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### Seven-Step Analysis Pipeline Details
- Step 0: Context Collection
  - Agent 0 gathers user profile and timeline context.
  - Updates AnalysisState with collected context.
- Step 1: Timeline Extraction
  - Agent A extracts a structured timeline event.
  - Provides event_summary, emotion_tag, importance_score, event_type, and related_entities.
- Steps 2.1–2.4: Satir Analysis
  - B1: Emotion layer analysis (surface and underlying emotions).
  - B2: Belief/cognitive layers (irrational beliefs, automatic thoughts, core beliefs, life rules).
  - B3: Existence layer (yearnings, life energy, deepest desire, existence insight).
  - B4: Therapeutic response generation.
- Step 3: Social Content Generation
  - Agent C generates multiple social media post variants.

**Section sources**
- [orchestrator.py:83-109](file://backend/app/agents/orchestrator.py#L83-L109)
- [agent_impl.py:100-141](file://backend/app/agents/agent_impl.py#L100-L141)
- [agent_impl.py:152-202](file://backend/app/agents/agent_impl.py#L152-L202)
- [agent_impl.py:214-393](file://backend/app/agents/agent_impl.py#L214-L393)
- [agent_impl.py:404-483](file://backend/app/agents/agent_impl.py#L404-L483)

### format_result Output Structure
The method transforms internal AnalysisState into a standardized result:
- diary_id, user_id
- timeline_event
- satir_analysis: behavior_layer, emotion_layer, cognitive_layer, belief_layer, core_self_layer
- therapeutic_response
- social_posts
- metadata: processing_time, current_step, error, workflow, workflow_detail, agent_runs

**Section sources**
- [orchestrator.py:132-171](file://backend/app/agents/orchestrator.py#L132-L171)

### Example Usage
- API endpoint usage:
  - The endpoint orchestrates analysis, formats results, persists timeline events and analysis results, and returns the formatted output.
- Test usage:
  - The test script demonstrates end-to-end execution with sample inputs and prints selected fields from the state.

**Section sources**
- [ai.py:521-632](file://backend/app/api/v1/ai.py#L521-L632)
- [test_ai_agents.py:72-127](file://backend/test_ai_agents.py#L72-L127)
# Epic Definition: TechGraph RAG (The Node Walk)

## 1. Project Vision

The main goal of the project is to build a **technical intelligence aggregator** from the most prestigious software engineering sources (Airbnb, AWS, Netflix, GitHub, etc., sourced from a provided OPML file).
Unlike traditional search engines or generic chats, this system will act as a **RAG (Retrieval-Augmented Generation)** engine that processes complex technical queries and returns the answer visually structured through an **Interactive Knowledge Graph**. In this graph, nodes represent key concepts and include direct traceability (URLs) back to the original source, while edges represent the semantic relationships between those concepts.

The infrastructure will be designed to be **100% open-source, local, and privacy-focused**, leveraging the power of Apple Silicon hardware (M3 Pro, 36GB RAM) by running Local Language Models (LLMs) with **Ollama**.

## 2. Main Epics

### Epic 1: Automated Ingestion and Knowledge Refinement (Data Pipeline)

**Goal:** Continuously extract, clean, and chunk knowledge from engineering blogs.

- **User Stories / Tasks:**
  - Parse the `engineering_blogs.opml` file to maintain the list of subscriptions (RSS Feeds).
  - Develop a Node.js _worker_ that periodically polls the RSS feeds for new articles.
  - Implement clean text extraction (removing menus, ads, and unnecessary HTML) using libraries such as `@mozilla/readability`.
  - Design a semantic _Chunking_ mechanism to split long articles into processable fragments (e.g. 500-1000 tokens).

### Epic 2: Local Vector Storage Engine

**Goal:** Persist text fragments as mathematical representations (vectors) to enable ultra-fast semantic search.

- **User Stories / Tasks:**
  - Deploy **ChromaDB** via Docker Compose (`infra:up`).
  - Integrate Ollama's local embeddings model (`nomic-embed-text` or `mxbai-embed-large`).
  - Define and implement the metadata schema (Payload) in ChromaDB to guarantee node traceability (blog, title, URL, date, chunk_index).

### Epic 3: RAG System (Search and Contextualization)

**Goal:** Retrieve highly relevant information based on the intent of the user's question, not just keywords.

- **User Stories / Tasks:**
  - Build an endpoint (API) that receives the user's query (prompt).
  - Vectorize the query using the same local embeddings model.
  - Query ChromaDB to retrieve the most relevant text fragments (chunks) (Top-K) along with their metadata (source URL).

### Epic 4: Structured Graph Generation with LLMs

**Goal:** Force a local LLM to reason over the retrieved context and emit a response in a strictly predictable format (JSON).

- **User Stories / Tasks:**
  - Configure the connection to Ollama to instantiate a deep-reasoning model (`llama3.1:8b`, `qwen2.5:7b`, or `qwen2.5:32b`).
  - Apply advanced _Prompt Engineering_ to force JSON output.
  - The resulting JSON schema must contain two arrays: `nodes` (id, label, source_url, snippet) and `edges` (source_id, target_id, relation_label).

### Epic 5: Interactive Visual Frontend (The "Node Walk")

**Goal:** Consume the structured JSON and render the response for the user.

- **User Stories / Tasks:**
  - Design a minimalist UI with a technical search bar.
  - Integrate a graph-rendering library such as **React Flow** or **Vis.js**.
  - Dynamically render the vertices (Nodes), making them clickable so they redirect to the original technical blog for that piece of information.

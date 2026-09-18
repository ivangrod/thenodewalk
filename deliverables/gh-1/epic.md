# Definición de Épica: TechGraph RAG (The Node Walk)

## 1. Visión del Proyecto
El objetivo principal del proyecto es construir un **agregador de inteligencia técnica** a partir de las fuentes más prestigiosas de la ingeniería de software (Airbnb, AWS, Netflix, GitHub, etc., provenientes de un fichero OPML proporcionado). 
A diferencia de los buscadores tradicionales o los chats genéricos, este sistema actuará como un motor **RAG (Retrieval-Augmented Generation)** que procesará consultas técnicas complejas y devolverá la respuesta estructurada visualmente mediante un **Grafo de Conocimiento Interactivo**. En este grafo, los nodos representarán conceptos clave e incluirán trazabilidad directa (URLs) a la fuente original, y las aristas representarán las relaciones semánticas entre dichos conceptos.

La infraestructura estará diseñada para ser **100% open-source, local, y centrada en la privacidad**, aprovechando la potencia del hardware de Apple Silicon (M3 Pro, 36GB RAM) mediante la ejecución de Modelos de Lenguaje Locales (LLMs) con **Ollama**.

## 2. Épicas Principales

### Épica 1: Ingesta Automática y Refinamiento de Conocimiento (Data Pipeline)
**Objetivo:** Extraer, limpiar y fragmentar continuamente el conocimiento de los blogs de ingeniería.
* **Historias de Usuario / Tareas:**
  * Parsear el fichero `engineering_blogs.opml` para mantener la lista de suscripciones (Feeds RSS).
  * Desarrollar un *worker* en Node.js que consulte periódicamente los RSS feeds en busca de nuevos artículos.
  * Implementar extracción de texto limpio (removiendo menús, anuncios, y HTML innecesario) utilizando librerías como `@mozilla/readability`.
  * Diseñar un mecanismo de *Chunking* semántico para dividir artículos largos en fragmentos procesables (ej. 500-1000 tokens).

### Épica 2: Motor de Almacenamiento Vectorial Local
**Objetivo:** Persistir los fragmentos de texto como representaciones matemáticas (vectores) para permitir búsquedas semánticas ultrarrápidas.
* **Historias de Usuario / Tareas:**
  * Desplegar **ChromaDB** a través de Docker Compose (`infra:up`).
  * Integrar el modelo de embeddings local de Ollama (`nomic-embed-text` o `mxbai-embed-large`).
  * Definir e implementar el esquema de metadatos (Payload) en ChromaDB para garantizar la trazabilidad de los nodos (blog, título, URL, fecha, chunk_index).

### Épica 3: Sistema RAG (Búsqueda y Contextualización)
**Objetivo:** Recuperar información altamente relevante basándose en la intención de la pregunta del usuario, no solo en palabras clave.
* **Historias de Usuario / Tareas:**
  * Construir un endpoint (API) que reciba la consulta (prompt) del usuario.
  * Vectorizar la consulta usando el mismo modelo de embeddings local.
  * Consultar ChromaDB para recuperar los fragmentos de texto (chunks) más relevantes (Top-K) junto con sus metadatos (URL de origen).

### Épica 4: Generación Estructurada de Grafos con LLMs
**Objetivo:** Forzar a un LLM local a razonar sobre el contexto recuperado y emitir una respuesta en un formato estrictamente predecible (JSON).
* **Historias de Usuario / Tareas:**
  * Configurar la conexión con Ollama para instanciar un modelo de razonamiento profundo (`llama3.1:8b`, `qwen2.5:7b` o `qwen2.5:32b`).
  * Aplicar *Prompt Engineering* avanzado forzando salida JSON.
  * El esquema JSON resultante debe contener dos arrays: `nodes` (id, label, source_url, snippet) y `edges` (source_id, target_id, relation_label).

### Épica 5: Frontend Visual Interactivo (El "Node Walk")
**Objetivo:** Consumir el JSON estructurado y pintar la respuesta para el usuario.
* **Historias de Usuario / Tareas:**
  * Diseñar una UI minimalista con una barra de búsqueda técnica.
  * Integrar una librería de renderizado de grafos como **React Flow** o **Vis.js**.
  * Pintar dinámicamente los vértices (Nodos) haciendo que sean clickeables y redirijan al blog técnico originario de esa pieza de información.

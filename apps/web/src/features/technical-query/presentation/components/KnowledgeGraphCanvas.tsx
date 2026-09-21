'use client';

import '@xyflow/react/dist/style.css';

import { Background, Controls, ReactFlow, type Edge } from '@xyflow/react';
import type { ReactElement } from 'react';

import type { KnowledgeGraph } from '@thenodewalk/contracts';

import { ConceptNode, type ConceptFlowNode } from './ConceptNode';

const nodeTypes = { concept: ConceptNode };
const LAYOUT_RADIUS = 220;

function toFlowNodes(graph: KnowledgeGraph): ConceptFlowNode[] {
  const total = Math.max(1, graph.nodes.length);
  return graph.nodes.map((node, index) => {
    const angle = (2 * Math.PI * index) / total;
    return {
      id: node.id,
      type: 'concept',
      position: {
        x: LAYOUT_RADIUS + Math.cos(angle) * LAYOUT_RADIUS,
        y: LAYOUT_RADIUS + Math.sin(angle) * LAYOUT_RADIUS,
      },
      data: { label: node.label, sourceUrl: node.sourceUrl },
    };
  });
}

function toFlowEdges(graph: KnowledgeGraph): Edge[] {
  return graph.edges.map((edge, index) => ({
    id: `${edge.source}-${edge.target}-${index}`,
    source: edge.source,
    target: edge.target,
    label: edge.relationship,
  }));
}

export interface KnowledgeGraphCanvasProps {
  graph: KnowledgeGraph;
}

/**
 * Heavy, client-only React Flow visualization. Loaded lazily (see
 * `KnowledgeGraph`) to keep it out of the initial bundle.
 */
export default function KnowledgeGraphCanvas({ graph }: KnowledgeGraphCanvasProps): ReactElement {
  return (
    <div
      aria-label="Interactive knowledge graph"
      className="h-[28rem] w-full overflow-hidden rounded-2xl border bg-card"
      role="figure"
    >
      <ReactFlow
        edges={toFlowEdges(graph)}
        fitView
        nodeTypes={nodeTypes}
        nodes={toFlowNodes(graph)}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

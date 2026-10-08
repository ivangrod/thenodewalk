'use client';

import '@xyflow/react/dist/style.css';

import { Background, Controls, ReactFlow, type Edge } from '@xyflow/react';
import type { ReactElement } from 'react';

import type { KnowledgeGraph } from '@thenodewalk/contracts';

import { ConceptNode, type ConceptFlowNode } from './ConceptNode';

const nodeTypes = { concept: ConceptNode };
const LAYOUT_RADIUS = 220;
const LAYOUT_CENTRE = { x: LAYOUT_RADIUS, y: LAYOUT_RADIUS };

function ringPosition(index: number, total: number): { x: number; y: number } {
  const angle = (2 * Math.PI * index) / Math.max(1, total);
  return {
    x: LAYOUT_CENTRE.x + Math.cos(angle) * LAYOUT_RADIUS,
    y: LAYOUT_CENTRE.y + Math.sin(angle) * LAYOUT_RADIUS,
  };
}

/**
 * Places the central node (the main idea) in the middle of the canvas and the
 * remaining concepts evenly on a circle around it. Without a known central node,
 * every concept is placed on the circle.
 */
function toFlowNodes(graph: KnowledgeGraph): ConceptFlowNode[] {
  const centralNode = graph.nodes.find((node) => node.id === graph.centralNodeId);
  const ringNodes = graph.nodes.filter((node) => node !== centralNode);

  return graph.nodes.map((node) => {
    const isCentral = node === centralNode;
    return {
      id: node.id,
      type: 'concept',
      position: isCentral ? LAYOUT_CENTRE : ringPosition(ringNodes.indexOf(node), ringNodes.length),
      data: { label: node.label, source: node.source, isCentral },
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

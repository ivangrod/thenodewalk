'use client';

import { Graph, type GraphType } from 'd3-graph-react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import type { KnowledgeGraph } from '@thenodewalk/contracts';
import { Button } from '@/components/ui/button';
import { ArticleSourceDialog } from './ArticleSourceDialog';
import { ConceptNode, SourceActivationContext, type ConceptGraphNode } from './ConceptNode';

interface ConceptLink {
  source: number;
  target: number;
  relationship: string;
}

function RelationshipLink({
  link,
  sourceNode,
  targetNode,
}: Parameters<
  NonNullable<GraphType<ConceptGraphNode, ConceptLink>['LinkComponent']>
>[0]): ReactElement {
  const markerId = useId();
  const dx = targetNode.x - sourceNode.x;
  const dy = targetNode.y - sourceNode.y;
  const distance = Math.hypot(dx, dy) || 1;
  const inset = Math.min(96, distance / 2);
  return (
    <g className="text-muted-foreground">
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
        </marker>
      </defs>
      <line
        x1={sourceNode.x}
        y1={sourceNode.y}
        x2={targetNode.x - (dx / distance) * inset}
        y2={targetNode.y - (dy / distance) * inset}
        stroke="var(--muted-foreground)"
        strokeWidth={2}
        markerEnd={`url(#${markerId})`}
      />
      <text
        x={(sourceNode.x + targetNode.x) / 2}
        y={(sourceNode.y + targetNode.y) / 2 - 8}
        textAnchor="middle"
        fill="currentColor"
        fontSize={12}
      >
        {link.relationship}
      </text>
    </g>
  );
}

export default function KnowledgeGraphCanvas({ graph }: { graph: KnowledgeGraph }): ReactElement {
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [active, setActive] = useState<{ graph: KnowledgeGraph; id: string } | null>(null);
  const data = useMemo(() => {
    const indices = new Map(graph.nodes.map((node, index) => [node.id, index]));
    return {
      nodes: graph.nodes.map((node) => ({ ...node, isCentral: node.id === graph.centralNodeId })),
      links: graph.edges.flatMap((edge) => {
        const source = indices.get(edge.source),
          target = indices.get(edge.target);
        return source === undefined || target === undefined
          ? []
          : [{ source, target, relationship: edge.relationship }];
      }),
    };
  }, [graph]);
  const initialize: NonNullable<GraphType<ConceptGraphNode, ConceptLink>['onSimulationCreated']> =
    useCallback(
      (simulation) => {
        const nodes = simulation.nodes();
        const ring = nodes.filter((node) => node.id !== graph.centralNodeId);
        const radius = Math.max(180, ring.length * 38);
        for (const node of nodes) {
          const index = ring.indexOf(node);
          const angle = (2 * Math.PI * index) / Math.max(1, ring.length);
          node.x = node.fx = index === -1 ? 0 : Math.cos(angle) * radius;
          node.y = node.fy = index === -1 ? 0 : Math.sin(angle) * radius;
        }
        simulation.stop();
      },
      [graph.centralNodeId],
    );
  useEffect(() => {
    const svg = container.current?.querySelector('svg');
    if (!svg) return;
    const radius = Math.max(180, data.nodes.length * 38) + 110;
    svg.setAttribute('viewBox', `${-radius} ${-radius} ${radius * 2} ${radius * 2}`);
  }, [data]);
  const openSource = useCallback(
    (node: ConceptGraphNode, button: HTMLButtonElement): void => {
      trigger.current = button;
      setActive({ graph, id: node.id });
    },
    [graph],
  );
  const navigate = (action: 'in' | 'out' | 'reset'): void => {
    const svg = container.current?.querySelector('svg');
    if (!svg) return;
    const selection = select<SVGSVGElement, unknown>(svg);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on('zoom', (event) => {
        selection.select('g').attr('transform', event.transform.toString());
      });
    if (action === 'reset') selection.call(behavior.transform, zoomIdentity);
    else
      selection.call(
        behavior.scaleTo,
        Math.max(0.5, Math.min(4, zoomTransform(svg).k * (action === 'in' ? 1.25 : 0.8))),
      );
  };
  const selected =
    active?.graph === graph ? (graph.nodes.find((node) => node.id === active.id) ?? null) : null;
  return (
    <SourceActivationContext.Provider value={openSource}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" aria-label="Graph controls">
          <Button variant="outline" onClick={() => navigate('in')}>
            Zoom in
          </Button>
          <Button variant="outline" onClick={() => navigate('out')}>
            Zoom out
          </Button>
          <Button variant="outline" onClick={() => navigate('reset')}>
            Reset view
          </Button>
        </div>
        <div
          ref={container}
          role="figure"
          aria-label="Interactive knowledge graph"
          className="h-[28rem] overflow-hidden rounded-2xl border bg-muted/30"
        >
          <Graph<ConceptGraphNode, ConceptLink>
            key={JSON.stringify(data)}
            graph={data}
            NodeComponent={ConceptNode}
            LinkComponent={RelationshipLink}
            onSimulationCreated={initialize}
            isNodeDraggable={false}
            ambientAlphaTarget={0}
            zoomScale={[0.5, 4]}
            containerClassName="knowledge-graph h-full w-full"
            svgClassName="h-full w-full"
          />
        </div>
        <details className="rounded-xl border bg-card p-3 text-sm">
          <summary className="cursor-pointer font-medium">Graph relationships (text view)</summary>
          <ul className="mt-3 space-y-2">
            {graph.edges.map((edge, index) => (
              <li key={index}>
                {graph.nodes.find((node) => node.id === edge.source)?.label} → {edge.relationship} →{' '}
                {graph.nodes.find((node) => node.id === edge.target)?.label}
              </li>
            ))}
          </ul>
        </details>
      </div>
      <ArticleSourceDialog
        node={selected}
        onClose={() => setActive(null)}
        trigger={trigger.current}
      />
    </SourceActivationContext.Provider>
  );
}

'use client';

import { Graph, type GraphType } from 'd3-graph-react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import type { KnowledgeGraph } from '@thenodewalk/contracts';
import { Button } from '@/components/ui/button';
import { ArticleSourceDialog } from './ArticleSourceDialog';
import { BookSourceDialog } from './BookSourceDialog';
import { ConceptNode, SourceActivationContext, type ConceptGraphNode } from './ConceptNode';
import { layoutKnowledgeGraph } from '../graph-layout';

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
  const simulationRef = useRef<
    | Parameters<NonNullable<GraphType<ConceptGraphNode, ConceptLink>['onSimulationCreated']>>[0]
    | null
  >(null);
  const drag = useRef<{
    index: number;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const positions = useMemo(() => layoutKnowledgeGraph(graph), [graph]);
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
        simulationRef.current = simulation;
        for (const node of nodes) {
          const point = positions.get(String(node.id)) ?? { x: 0, y: 0 };
          node.x = node.fx = point.x;
          node.y = node.fy = point.y;
          node.vx = node.vy = 0;
        }
        simulation.stop();
      },
      [positions],
    );
  useEffect(() => {
    const svg = container.current?.querySelector('svg');
    if (!svg) return;
    const radius =
      Math.max(
        270,
        ...[...positions.values()].map(({ x, y }) => Math.max(Math.abs(x), Math.abs(y))),
      ) + 150;
    svg.setAttribute('viewBox', `${-radius} ${-radius} ${radius * 2} ${radius * 2}`);
  }, [positions]);
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
      <div className="knowledge-graph-theme overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0d1019] text-slate-100">
        <div
          className="flex flex-wrap items-center gap-2 border-b border-slate-800 bg-[#11141d] px-4 py-3"
          aria-label="Graph controls"
        >
          <span className="mr-auto text-sm font-semibold">
            Knowledge graph{' '}
            <span className="ml-2 text-xs font-normal text-slate-400">
              {data.nodes.length} concepts
            </span>
          </span>
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
          className="h-[36rem] overflow-hidden bg-[radial-gradient(circle,#334155_1px,transparent_1px)] bg-size-[20px_20px] lg:h-[calc(100vh-8rem)]"
          onMouseDownCapture={(event) => {
            if ((event.target as Element).closest('.node')) event.stopPropagation();
          }}
          onPointerDownCapture={(event) => {
            if (event.button !== 0) return;
            const element = (event.target as Element).closest('.node');
            const elements = event.currentTarget.querySelectorAll('.node');
            const index = Array.from(elements).indexOf(element as Element);
            const node = simulationRef.current?.nodes()[index];
            if (!node) return;
            suppressClick.current = false;
            drag.current = {
              index,
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              x: node.x,
              y: node.y,
              moved: false,
            };
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current || current.pointerId !== event.pointerId) return;
            const svg = event.currentTarget.querySelector('svg');
            const matrix = svg?.querySelector('g')?.getScreenCTM();
            const node = simulationRef.current?.nodes()[current.index];
            if (!matrix || !node) return;
            const inverse = matrix.inverse();
            const delta = new DOMPoint(
              event.clientX - current.startX,
              event.clientY - current.startY,
            ).matrixTransform(new DOMMatrix([inverse.a, inverse.b, inverse.c, inverse.d, 0, 0]));
            if (
              Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 5 &&
              !current.moved
            )
              return;
            current.moved = true;
            if (!event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.setPointerCapture(event.pointerId);
            node.x = node.fx = current.x + delta.x;
            node.y = node.fy = current.y + delta.y;
            simulationRef.current?.alpha(0.05).restart();
          }}
          onPointerUp={(event) => {
            if (drag.current?.pointerId !== event.pointerId) return;
            suppressClick.current = drag.current.moved;
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onClickCapture={(event) => {
            if (suppressClick.current) {
              event.preventDefault();
              event.stopPropagation();
              suppressClick.current = false;
            }
          }}
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
      </div>
      <ArticleSourceDialog
        node={selected}
        onClose={() => setActive(null)}
        trigger={trigger.current}
      />
      <BookSourceDialog node={selected} onClose={() => setActive(null)} trigger={trigger.current} />
    </SourceActivationContext.Provider>
  );
}

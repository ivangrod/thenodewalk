import type { KnowledgeGraph } from '@thenodewalk/contracts';

export interface GraphPosition {
  x: number;
  y: number;
}

/** Fixed card spacing and bounded search keep layout work outside the animation loop. */
const CARD_SPACING = 300;
const SEARCH_LIMIT = 6000;

/**
 * Orders nodes around the centre to minimise straight-edge crossings. For small
 * graphs all ring orders are considered; larger graphs use bounded pair swaps.
 * Non-planar graphs may still have crossings. This function never changes topology.
 */
export function layoutKnowledgeGraph(graph: KnowledgeGraph): Map<string, GraphPosition> {
  const centre = graph.nodes.find(({ id }) => id === graph.centralNodeId);
  const ring = graph.nodes.filter((node) => node !== centre).map(({ id }) => id);
  const radius = Math.max(360, (ring.length * CARD_SPACING) / (2 * Math.PI));
  const positionAt = (index: number): GraphPosition => {
    // Break exact diameters so a chord cannot run directly through the central card.
    const angle = (2 * Math.PI * index) / Math.max(1, ring.length) + 0.08 * Math.sin(index + 1);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  };
  const positionsFor = (order: string[]): Map<string, GraphPosition> => {
    const positions = new Map(order.map((id, index) => [id, positionAt(index)]));
    if (centre) positions.set(centre.id, { x: 0, y: 0 });
    return positions;
  };
  let best = [...ring];
  let bestCost = layoutCost(graph, positionsFor(best));
  let attempts = 0;
  const consider = (order: string[]): void => {
    if (attempts++ >= SEARCH_LIMIT) return;
    const cost = layoutCost(graph, positionsFor(order));
    if (cost < bestCost) {
      best = [...order];
      bestCost = cost;
    }
  };
  if (ring.length <= 7) {
    const permute = (order: string[], start: number): void => {
      if (attempts >= SEARCH_LIMIT) return;
      if (start === order.length) {
        consider(order);
        return;
      }
      for (let index = start; index < order.length; index++) {
        [order[start], order[index]] = [order[index]!, order[start]!];
        permute(order, start + 1);
        [order[start], order[index]] = [order[index]!, order[start]!];
      }
    };
    permute([...ring], 0);
  } else {
    for (let pass = 0; pass < 4 && attempts < SEARCH_LIMIT; pass++) {
      const previous = bestCost;
      for (let left = 0; left < ring.length && attempts < SEARCH_LIMIT; left++) {
        for (let right = left + 1; right < ring.length && attempts < SEARCH_LIMIT; right++) {
          const candidate = [...best];
          [candidate[left], candidate[right]] = [candidate[right]!, candidate[left]!];
          consider(candidate);
        }
      }
      if (bestCost === previous) break;
    }
  }
  return positionsFor(best);
}

function layoutCost(graph: KnowledgeGraph, positions: Map<string, GraphPosition>): number {
  const edges = graph.edges.filter(
    ({ source, target }) => source !== target && positions.has(source) && positions.has(target),
  );
  let crossings = 0;
  let obscured = 0;
  let length = 0;
  for (const [index, edge] of edges.entries()) {
    const start = positions.get(edge.source)!;
    const end = positions.get(edge.target)!;
    length += Math.hypot(start.x - end.x, start.y - end.y);
    for (const [id, point] of positions) {
      if (id !== edge.source && id !== edge.target && distanceToSegment(point, start, end) < 115)
        obscured++;
    }
    for (const other of edges.slice(index + 1)) {
      if (
        [edge.source, edge.target].includes(other.source) ||
        [edge.source, edge.target].includes(other.target)
      )
        continue;
      if (segmentsCross(start, end, positions.get(other.source)!, positions.get(other.target)!))
        crossings++;
    }
  }
  return crossings * 1e9 + obscured * 1e6 + length;
}

export function segmentsCross(
  a: GraphPosition,
  b: GraphPosition,
  c: GraphPosition,
  d: GraphPosition,
): boolean {
  const orientation = (p: GraphPosition, q: GraphPosition, r: GraphPosition): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return (
    orientation(a, b, c) * orientation(a, b, d) < 0 &&
    orientation(c, d, a) * orientation(c, d, b) < 0
  );
}

function distanceToSegment(point: GraphPosition, start: GraphPosition, end: GraphPosition): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const squared = dx * dx + dy * dy;
  const t =
    squared === 0
      ? 0
      : Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / squared));
  return Math.hypot(point.x - start.x - t * dx, point.y - start.y - t * dy);
}

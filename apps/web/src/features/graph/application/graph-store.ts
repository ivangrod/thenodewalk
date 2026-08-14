'use client';

import { create } from 'zustand';

import type { GraphNode } from '../domain/node';

interface GraphState {
  nodes: GraphNode[];
  addNode: (node: GraphNode) => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
}));

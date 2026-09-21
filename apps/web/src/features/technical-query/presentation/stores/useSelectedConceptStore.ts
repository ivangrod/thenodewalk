'use client';

import { create } from 'zustand';

/**
 * Interactive client-only UI state for the knowledge graph: which concept node
 * is currently selected/highlighted. The server response is never stored here.
 */
interface SelectedConceptState {
  selectedNodeId: string | null;
  select: (nodeId: string) => void;
  clear: () => void;
}

export const useSelectedConceptStore = create<SelectedConceptState>((set) => ({
  selectedNodeId: null,
  select: (nodeId) => set({ selectedNodeId: nodeId }),
  clear: () => set({ selectedNodeId: null }),
}));

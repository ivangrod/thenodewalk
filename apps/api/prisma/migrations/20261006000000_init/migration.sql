CREATE SCHEMA IF NOT EXISTS "public";
CREATE TABLE "User" (
 "id" TEXT NOT NULL, "email" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MindMap" (
 "id" TEXT NOT NULL, "title" TEXT NOT NULL, "ownerId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MindMap_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MindMapNode" (
 "id" TEXT NOT NULL, "mindMapId" TEXT NOT NULL, "title" TEXT NOT NULL,
 "content" JSONB, "position" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "MindMapNode_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MindMapEdge" (
 "id" TEXT NOT NULL, "mindMapId" TEXT NOT NULL, "sourceNodeId" TEXT NOT NULL, "targetNodeId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "MindMapEdge_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "MindMap_ownerId_idx" ON "MindMap"("ownerId");
CREATE INDEX "MindMapNode_mindMapId_idx" ON "MindMapNode"("mindMapId");
CREATE INDEX "MindMapEdge_mindMapId_idx" ON "MindMapEdge"("mindMapId");
CREATE UNIQUE INDEX "MindMapEdge_sourceNodeId_targetNodeId_key" ON "MindMapEdge"("sourceNodeId", "targetNodeId");
ALTER TABLE "MindMap" ADD CONSTRAINT "MindMap_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MindMapNode" ADD CONSTRAINT "MindMapNode_mindMapId_fkey" FOREIGN KEY ("mindMapId") REFERENCES "MindMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MindMapEdge" ADD CONSTRAINT "MindMapEdge_mindMapId_fkey" FOREIGN KEY ("mindMapId") REFERENCES "MindMap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MindMapEdge" ADD CONSTRAINT "MindMapEdge_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "MindMapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MindMapEdge" ADD CONSTRAINT "MindMapEdge_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "MindMapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

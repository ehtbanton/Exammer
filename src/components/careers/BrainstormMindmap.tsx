"use client";

import { useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Custom node component for brainstorm nodes
function BrainstormNode({ data }: { data: any }) {
  const isRoot = data.isRoot;
  const isExpanded = data.isExpanded;

  return (
    <Card
      className={`px-6 py-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer ${
        isRoot
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card border-2'
      } ${!isExpanded && !isRoot ? 'border-dashed' : ''}`}
      onClick={data.onExpand}
    >
      <div className="flex items-center gap-2">
        {!isExpanded && !isRoot && (
          <Sparkles className="w-4 h-4 text-muted-foreground" />
        )}
        <div className="font-medium text-sm text-center min-w-[120px]">
          {data.label}
        </div>
      </div>
    </Card>
  );
}

const nodeTypes: NodeTypes = {
  brainstorm: BrainstormNode,
};

interface BrainstormMindmapProps {
  sessionId: number;
  initialQuestion?: string;
  onComplete: () => void;
}

export default function BrainstormMindmap({
  sessionId,
  initialQuestion = "What do you enjoy doing academically?",
  onComplete,
}: BrainstormMindmapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isExpanding, setIsExpanding] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const { toast } = useToast();

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Start the brainstorming session
  const handleStart = async () => {
    setHasStarted(true);

    // Create root node
    const rootNode: Node = {
      id: 'root',
      type: 'brainstorm',
      position: { x: 250, y: 50 },
      data: {
        label: initialQuestion,
        isRoot: true,
        isExpanded: false,
        onExpand: () => handleExpandNode('root', initialQuestion),
      },
    };

    setNodes([rootNode]);
  };

  // Expand a node by generating related terms
  const handleExpandNode = async (nodeId: string, nodeLabel: string) => {
    // Check if already expanded
    const node = nodes.find((n) => n.id === nodeId);
    if (node?.data.isExpanded) return;

    setIsExpanding(true);

    try {
      // Call API to get expansion suggestions
      const response = await fetch('/api/careers/brainstorm/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          nodeId,
          nodeLabel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to expand node');
      }

      const data = await response.json();
      const suggestions: string[] = data.suggestions;

      // Mark current node as expanded
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, isExpanded: true } }
            : n
        )
      );

      // Calculate positions for new nodes (arranged in a circle around parent)
      const parentNode = nodes.find((n) => n.id === nodeId);
      if (!parentNode) return;

      const radius = 200;
      const angleStep = (2 * Math.PI) / suggestions.length;
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      suggestions.forEach((suggestion, index) => {
        const angle = angleStep * index - Math.PI / 2; // Start from top
        const x = parentNode.position.x + radius * Math.cos(angle);
        const y = parentNode.position.y + radius * Math.sin(angle);

        const childId = `${nodeId}-${index}`;

        newNodes.push({
          id: childId,
          type: 'brainstorm',
          position: { x, y },
          data: {
            label: suggestion,
            isRoot: false,
            isExpanded: false,
            onExpand: () => handleExpandNode(childId, suggestion),
          },
        });

        newEdges.push({
          id: `${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
          type: 'smoothstep',
          animated: true,
        });
      });

      setNodes((nds) => [...nds, ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);

      toast({
        title: 'Ideas generated!',
        description: `Found ${suggestions.length} related areas to explore`,
      });
    } catch (error) {
      console.error('Error expanding node:', error);
      toast({
        title: 'Failed to generate ideas',
        description: 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsExpanding(false);
    }
  };

  // Save brainstorm session
  const handleSaveBrainstorm = async () => {
    try {
      await fetch('/api/careers/brainstorm/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          nodes: nodes.map(n => ({
            id: n.id,
            label: n.data.label,
            position: n.position,
            isRoot: n.data.isRoot,
          })),
          edges: edges.map(e => ({
            source: e.source,
            target: e.target,
          })),
        }),
      });

      toast({
        title: 'Brainstorm saved!',
        description: 'Your exploration has been saved',
      });

      onComplete();
    } catch (error) {
      console.error('Error saving brainstorm:', error);
      toast({
        title: 'Failed to save',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  if (!hasStarted) {
    return (
      <Card className="p-8 text-center max-w-2xl mx-auto">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
        <h2 className="text-2xl font-bold mb-4">Let's Explore Your Interests</h2>
        <p className="text-muted-foreground mb-6">
          We'll start with a simple question and expand it into a visual mindmap
          of your academic interests and potential career paths.
        </p>
        <div className="bg-muted/50 p-4 rounded-lg mb-6">
          <p className="font-medium mb-2">Starting question:</p>
          <p className="text-lg">{initialQuestion}</p>
        </div>
        <Button onClick={handleStart} size="lg">
          Start Exploring
          <Sparkles className="w-4 h-4 ml-2" />
        </Button>
      </Card>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls />
        <MiniMap />
      </ReactFlow>

      {/* Floating action bar */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <Card className="p-4 shadow-lg">
          <div className="flex items-center gap-4">
            {isExpanding && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating ideas...</span>
              </div>
            )}
            <Button onClick={handleSaveBrainstorm} disabled={isExpanding || nodes.length < 2}>
              Complete Brainstorm
            </Button>
          </div>
        </Card>
      </div>

      {/* Instructions overlay */}
      {nodes.length === 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="p-4 shadow-lg bg-primary text-primary-foreground">
            <p className="text-sm font-medium">
              👆 Click the starting question to generate related ideas
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

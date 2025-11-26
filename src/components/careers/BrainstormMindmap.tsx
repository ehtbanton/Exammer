"use client";

import { useCallback, useState, useEffect } from 'react';
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
import { Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BrainstormNodeModal from './BrainstormNodeModal';

// Custom node component for brainstorm nodes
function BrainstormNode({ data }: { data: any }) {
  const isRoot = data.isRoot;
  const isExpanded = data.isExpanded;

  return (
    <Card
      className={`px-6 py-4 shadow-md hover:shadow-lg transition-shadow cursor-pointer relative ${
        isRoot
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-card-foreground border-2'
      } ${!isExpanded && !isRoot ? 'border-dashed' : ''}`}
    >
      {!isExpanded && (
        <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
          <Sparkles className="w-3 h-3 text-primary-foreground" />
        </div>
      )}
      <div className="flex flex-col items-center gap-1">
        <div className="font-medium text-sm text-center min-w-[120px]">
          {data.label}
        </div>
        <div className={`text-xs ${isRoot ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {isExpanded ? 'Expanded' : 'Click to explore'}
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
  const [userAnswer, setUserAnswer] = useState('');
  const [selectedNode, setSelectedNode] = useState<{
    id: string;
    label: string;
    isRoot: boolean;
    isExpanded: boolean;
    parentPath: string[];
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Load existing nodes on mount
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const response = await fetch(`/api/careers/brainstorm/nodes?sessionId=${sessionId}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data.nodes && data.nodes.length > 0) {
            const loadedNodes = data.nodes.map((n: any) => ({
              id: n.node_id,
              type: 'brainstorm',
              position: { x: n.position_x, y: n.position_y },
              data: {
                label: n.label,
                isRoot: !!n.is_root,
                isExpanded: true,
              }
            }));
            
            const loadedEdges = data.nodes
              .filter((n: any) => n.parent_node_id)
              .map((n: any) => ({
                id: `${n.parent_node_id}-${n.node_id}`,
                source: n.parent_node_id,
                target: n.node_id,
                type: 'smoothstep',
                animated: true,
              }));

            setNodes(loadedNodes);
            setEdges(loadedEdges);
            setHasStarted(true);
          }
        }
      } catch (error) {
        console.error('Error loading nodes:', error);
      }
    };
    loadNodes();
  }, [sessionId, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Build parent path from node ID
  const buildParentPath = (nodeId: string): string[] => {
    if (nodeId === 'root') return [];

    const parts = nodeId.split('-').slice(1); // Remove 'root' prefix
    const path: string[] = [nodes.find(n => n.id === 'root')?.data.label || ''];

    // Build path by traversing up the node tree
    let currentId = 'root';
    for (let i = 0; i < parts.length - 1; i++) {
      currentId += `-${parts[i]}`;
      const parent = nodes.find(n => n.id === currentId);
      if (parent) path.push(parent.data.label);
    }

    return path;
  };

  // Handle node click to open modal
  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', node.id, node.data.label);
    
    const parentPath = buildParentPath(node.id);
    console.log('Parent path:', parentPath);

    setSelectedNode({
      id: node.id,
      label: node.data.label,
      isRoot: node.data.isRoot,
      isExpanded: node.data.isExpanded,
      parentPath,
    });
    setIsModalOpen(true);
    console.log('Modal should be open now');
  };

  // Handle expansion from modal
  const handleModalExpand = async () => {
    if (!selectedNode) return;

    await handleExpandNode(selectedNode.id, selectedNode.label);

    setSelectedNode({ ...selectedNode, isExpanded: true });

    // Close modal after brief delay to show success
    setTimeout(() => {
      setIsModalOpen(false);
    }, 1000);
  };

  // Start the brainstorming session
  const handleStart = async () => {
    setHasStarted(true);

    try {
      // Create root node with user's answer
      const rootNode: Node = {
        id: 'root',
        type: 'brainstorm',
        position: { x: 250, y: 50 },
        data: {
          label: userAnswer,
          isRoot: true,
          isExpanded: false,
        },
      };

      setNodes([rootNode]);
    } catch (error) {
      console.error('Error starting brainstorm:', error);
      toast({
        title: 'Failed to start',
        description: 'Please try again',
        variant: 'destructive',
      });
      setHasStarted(false);
    }
  };

  // Expand a node by generating related terms
  const handleExpandNode = async (nodeId: string, nodeLabel: string) => {
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
          parentPath: buildParentPath(nodeId),
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
    } catch (error: any) {
      console.error('Error expanding node:', error);

      // Extract error details from response if available
      const errorDetails = error.response?.data?.details || error.message;
      const description = errorDetails ? errorDetails : 'Please try again';

      toast({
        title: 'Failed to generate ideas',
        description,
        variant: 'destructive',
      });
    } finally {
      setIsExpanding(false);
    }
  };

  // Save brainstorm session
  const handleSaveBrainstorm = async () => {
    try {
      const response = await fetch('/api/careers/brainstorm/save', {
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

      if (!response.ok) {
        throw new Error('Failed to save brainstorm');
      }

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

  const handleExit = async () => {
    if (!confirm('Are you sure you want to exit? Your progress will be lost.')) return;
    
    try {
      await fetch('/api/careers/sessions/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
      window.location.reload();
    } catch (error) {
      console.error('Error resetting:', error);
      toast({
        title: 'Failed to reset',
        variant: 'destructive',
      });
    }
  };

  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-end mb-4">
          <Button variant="ghost" onClick={handleExit} className="text-muted-foreground hover:text-destructive flex gap-2">
            <RotateCcw className="w-4 h-4" />
            Exit
          </Button>
        </div>
        <Card className="p-8 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-bold mb-4">Let's Explore Your Interests</h2>
          <p className="text-muted-foreground mb-6">
            Tell us what you enjoy academically, and we'll help you explore related career paths.
          </p>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-left">
              {initialQuestion}
            </label>
            <textarea
              className="w-full p-3 border rounded-lg resize-none text-black"
              rows={3}
              placeholder="E.g., I enjoy solving complex math problems and working with data"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
            />
          </div>
          <Button
            onClick={handleStart}
            size="lg"
            disabled={!userAnswer.trim()}
          >
            Start Exploring
            <Sparkles className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-12rem)] w-full relative">
      <div className="absolute top-4 right-4 z-10">
        <Button variant="outline" onClick={handleExit} className="bg-background/80 backdrop-blur-sm flex gap-2">
          <RotateCcw className="w-4 h-4" />
          Exit
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
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
      {nodes.filter(n => !n.data.isExpanded).length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="p-4 shadow-lg bg-primary text-primary-foreground">
            <p className="text-sm font-medium">
              Click any node to see details and explore related career paths
            </p>
          </Card>
        </div>
      )}

      {/* Modal for node details */}
      <BrainstormNodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        node={selectedNode}
        onExpand={handleModalExpand}
        isExpanding={isExpanding}
      />
    </div>
  );
}
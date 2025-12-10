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
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, RotateCcw, Eye, EyeOff, Star, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import BrainstormNodeModal from './BrainstormNodeModal';
import { ConvergenceBanner } from './ConvergenceBanner';
import { PathSummaryModal } from './PathSummaryModal';

// Custom node component for brainstorm nodes
function BrainstormNode({ data }: { data: any }) {
  const isRoot = data.isRoot;
  const isExpanded = data.isExpanded;
  const isSelected = data.isSelected;
  const isActiveNode = data.isActiveNode;
  const isHidden = data.isHidden;

  if (isHidden) {
    return null;
  }

  return (
    <Card
      className={`px-6 py-4 shadow-md hover:shadow-lg transition-all cursor-pointer relative ${
        isRoot
          ? 'bg-primary text-primary-foreground border-primary'
          : isSelected
          ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 border-[3px] shadow-xl scale-105'
          : 'bg-card text-card-foreground border-2'
      } ${!isExpanded && !isRoot && !isSelected ? 'border-dashed' : ''} ${
        isActiveNode ? 'ring-2 ring-amber-400 ring-offset-2 animate-pulse' : ''
      }`}
      style={{
        opacity: data.opacity ?? 1,
        transition: 'opacity 0.5s ease-out, transform 0.2s ease-out',
      }}
    >
      {/* Golden path indicator */}
      {isSelected && !isRoot && (
        <div className="absolute -top-2 -left-2 bg-amber-500 rounded-full p-1 shadow-md">
          <Star className="w-3 h-3 text-white fill-white" />
        </div>
      )}

      {/* Unexpanded indicator */}
      {!isExpanded && !isSelected && (
        <div className="absolute -top-2 -right-2 bg-primary rounded-full p-1">
          <Sparkles className="w-3 h-3 text-primary-foreground" />
        </div>
      )}

      <div className="flex flex-col items-center gap-1">
        <div className="font-medium text-sm text-center min-w-[120px]">
          {data.label}
        </div>
        <div className={`text-xs ${
          isRoot ? 'text-primary-foreground/80'
          : isSelected ? 'text-amber-600 dark:text-amber-400'
          : 'text-muted-foreground'
        }`}>
          {isActiveNode ? 'Continue here'
           : isSelected ? 'On your path'
           : isExpanded ? 'Expanded'
           : 'Click to explore'}
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
    isSelected: boolean;
    parentPath: string[];
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();

  // Golden path state
  const [selectedPath, setSelectedPath] = useState<string[]>(['root']);
  const [viewMode, setViewMode] = useState<'focus' | 'overview'>('focus');
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [showConvergenceBanner, setShowConvergenceBanner] = useState(false);
  const [showPathSummary, setShowPathSummary] = useState(false);

  // Calculate convergence state
  const pathDepth = selectedPath.length;
  const totalNodes = nodes.length;

  // Check for convergence triggers
  useEffect(() => {
    if (pathDepth >= 4 && !showConvergenceBanner && !showPathSummary) {
      setShowConvergenceBanner(true);
    }
  }, [pathDepth, showConvergenceBanner, showPathSummary]);

  // Load existing nodes on mount
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const response = await fetch(`/api/careers/brainstorm/nodes?sessionId=${sessionId}`, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (data.nodes && data.nodes.length > 0) {
            // Build selected path from loaded nodes
            const selectedNodes = data.nodes.filter((n: any) => n.selected);
            const loadedSelectedPath = selectedNodes.length > 0
              ? ['root', ...selectedNodes.filter((n: any) => !n.is_root).map((n: any) => n.node_id)]
              : ['root'];

            const loadedNodes = data.nodes.map((n: any) => ({
              id: n.node_id,
              type: 'brainstorm',
              position: { x: n.position_x, y: n.position_y },
              data: {
                label: n.label,
                isRoot: !!n.is_root,
                isExpanded: true,
                isSelected: !!n.selected || !!n.is_root,
                isActiveNode: n.node_id === loadedSelectedPath[loadedSelectedPath.length - 1],
              }
            }));

            const loadedEdges = data.nodes
              .filter((n: any) => n.parent_node_id)
              .map((n: any) => {
                const isGoldenEdge = loadedSelectedPath.includes(n.parent_node_id) &&
                                     loadedSelectedPath.includes(n.node_id);
                return {
                  id: `${n.parent_node_id}-${n.node_id}`,
                  source: n.parent_node_id,
                  target: n.node_id,
                  type: 'smoothstep',
                  animated: true,
                  style: isGoldenEdge ? {
                    stroke: '#f59e0b',
                    strokeWidth: 3,
                  } : {
                    stroke: '#94a3b8',
                    strokeWidth: 1,
                  },
                  markerEnd: isGoldenEdge ? {
                    type: MarkerType.ArrowClosed,
                    color: '#f59e0b',
                  } : undefined,
                };
              });

            setNodes(loadedNodes);
            setEdges(loadedEdges);
            setSelectedPath(loadedSelectedPath);
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

    const parts = nodeId.split('-').slice(1);
    const path: string[] = [nodes.find(n => n.id === 'root')?.data.label || ''];

    let currentId = 'root';
    for (let i = 0; i < parts.length - 1; i++) {
      currentId += `-${parts[i]}`;
      const parent = nodes.find(n => n.id === currentId);
      if (parent) path.push(parent.data.label);
    }

    return path;
  };

  // Check if node is a child of the active node
  const isChildOfActiveNode = (nodeId: string): boolean => {
    const activeNodeId = selectedPath[selectedPath.length - 1];
    return nodeId.startsWith(activeNodeId + '-') && nodeId.split('-').length === activeNodeId.split('-').length + 1;
  };

  // Handle node click to open modal
  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    const parentPath = buildParentPath(node.id);

    setSelectedNode({
      id: node.id,
      label: node.data.label,
      isRoot: node.data.isRoot,
      isExpanded: node.data.isExpanded,
      isSelected: selectedPath.includes(node.id),
      parentPath,
    });
    setIsModalOpen(true);
  };

  // Handle selecting a node for the golden path
  const handleSelectNode = async (nodeId: string) => {
    // Build new path from root to this node
    const parts = nodeId.split('-');
    const newPath: string[] = ['root'];
    let currentId = 'root';
    for (let i = 1; i < parts.length; i++) {
      currentId += `-${parts[i]}`;
      newPath.push(currentId);
    }

    setSelectedPath(newPath);

    // Update node data to reflect selection
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isSelected: newPath.includes(n.id),
          isActiveNode: n.id === nodeId,
        }
      }))
    );

    // Update edge styling
    setEdges((eds) =>
      eds.map((e) => {
        const isGoldenEdge = newPath.includes(e.source) && newPath.includes(e.target);
        return {
          ...e,
          style: isGoldenEdge ? {
            stroke: '#f59e0b',
            strokeWidth: 3,
          } : {
            stroke: '#94a3b8',
            strokeWidth: 1,
          },
          markerEnd: isGoldenEdge ? {
            type: MarkerType.ArrowClosed,
            color: '#f59e0b',
          } : undefined,
        };
      })
    );

    // In focus mode, hide sibling nodes
    if (viewMode === 'focus') {
      const parentId = parts.slice(0, -1).join('-') || 'root';
      const siblings = nodes.filter(n =>
        n.id !== nodeId &&
        n.id.startsWith(parentId + '-') &&
        n.id.split('-').length === parts.length
      );

      // Fade out siblings
      setNodes((nds) =>
        nds.map((n) =>
          siblings.some(s => s.id === n.id)
            ? { ...n, data: { ...n.data, opacity: 0.3 } }
            : n
        )
      );

      // Hide siblings after fade
      setTimeout(() => {
        setHiddenNodes(prev => new Set([...prev, ...siblings.map(s => s.id)]));
      }, 500);
    }

    // Save selection to database
    try {
      await fetch('/api/careers/brainstorm/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, nodeId, selected: true }),
      });
    } catch (error) {
      console.error('Error saving selection:', error);
    }
  };

  // Handle expansion from modal (with optional selection)
  const handleModalExpand = async (shouldSelect: boolean = false) => {
    if (!selectedNode) return;

    // If selecting, first update the path
    if (shouldSelect && !selectedNode.isRoot) {
      await handleSelectNode(selectedNode.id);
    }

    await handleExpandNode(selectedNode.id, selectedNode.label);

    setSelectedNode({ ...selectedNode, isExpanded: true, isSelected: shouldSelect || selectedNode.isSelected });

    setTimeout(() => {
      setIsModalOpen(false);
    }, 1000);
  };

  // Handle convergence request
  const handleConverge = () => {
    setShowConvergenceBanner(false);
    setShowPathSummary(true);
  };

  // Handle path summary confirmation
  const handleConfirmPath = async () => {
    setShowPathSummary(false);
    await handleSaveBrainstorm();
  };

  // Toggle view mode
  const toggleViewMode = () => {
    if (viewMode === 'focus') {
      setViewMode('overview');
      setHiddenNodes(new Set());
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, opacity: 1 } }))
      );
    } else {
      setViewMode('focus');
      // Re-hide non-path nodes
      const nonPathNodes = nodes.filter(n =>
        !selectedPath.includes(n.id) && !isChildOfActiveNode(n.id)
      );
      setHiddenNodes(new Set(nonPathNodes.map(n => n.id)));
    }
  };

  // Start the brainstorming session
  const handleStart = async () => {
    setHasStarted(true);

    try {
      const rootNode: Node = {
        id: 'root',
        type: 'brainstorm',
        position: { x: 250, y: 50 },
        data: {
          label: userAnswer,
          isRoot: true,
          isExpanded: false,
          isSelected: true,
          isActiveNode: true,
        },
      };

      setNodes([rootNode]);
      setSelectedPath(['root']);
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

      const parentNode = nodes.find((n) => n.id === nodeId);
      if (!parentNode) return;

      const radius = 200;
      const angleStep = (2 * Math.PI) / suggestions.length;
      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      suggestions.forEach((suggestion, index) => {
        const angle = angleStep * index - Math.PI / 2;
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
            isSelected: false,
            isActiveNode: false,
          },
        });

        newEdges.push({
          id: `${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: '#94a3b8',
            strokeWidth: 1,
          },
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
            selected: selectedPath.includes(n.id),
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

  // Get path labels for summary
  const getPathLabels = (): { id: string; label: string }[] => {
    return selectedPath.map(nodeId => {
      const node = nodes.find(n => n.id === nodeId);
      return { id: nodeId, label: node?.data.label || nodeId };
    });
  };

  // Filter visible nodes based on view mode
  const visibleNodes = nodes.map(node => {
    if (viewMode === 'overview') {
      return { ...node, data: { ...node.data, isHidden: false, opacity: selectedPath.includes(node.id) ? 1 : 0.5 } };
    }
    const isHidden = hiddenNodes.has(node.id);
    return { ...node, data: { ...node.data, isHidden } };
  }).filter(node => !node.data.isHidden);

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
      {/* Top controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant="outline"
          onClick={toggleViewMode}
          className="bg-background/80 backdrop-blur-sm flex gap-2"
        >
          {viewMode === 'focus' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {viewMode === 'focus' ? 'Show All' : 'Focus Path'}
        </Button>
        <Button variant="outline" onClick={handleExit} className="bg-background/80 backdrop-blur-sm flex gap-2">
          <RotateCcw className="w-4 h-4" />
          Exit
        </Button>
      </div>

      {/* Depth indicator */}
      <div className="absolute top-4 left-4 z-10">
        <Card className="p-3 bg-background/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">Level {pathDepth}</span>
            <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${Math.min(pathDepth / 5 * 100, 100)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Convergence Banner */}
      <ConvergenceBanner
        show={showConvergenceBanner}
        depth={pathDepth}
        onAccept={handleConverge}
        onDismiss={() => setShowConvergenceBanner(false)}
      />

      {/* Path Summary Modal */}
      <PathSummaryModal
        isOpen={showPathSummary}
        path={getPathLabels()}
        onConfirm={handleConfirmPath}
        onCancel={() => setShowPathSummary(false)}
      />

      <ReactFlow
        nodes={visibleNodes}
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
            <Button
              onClick={() => setShowPathSummary(true)}
              disabled={isExpanding || nodes.length < 2}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Target className="w-4 h-4 mr-2" />
              Get University Recommendations
            </Button>
          </div>
        </Card>
      </div>

      {/* Instructions overlay */}
      {nodes.filter(n => !n.data.isExpanded).length > 0 && !showConvergenceBanner && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-10">
          <Card className="p-4 shadow-lg bg-primary text-primary-foreground">
            <p className="text-sm font-medium">
              Click any node to explore. Select your favorites to build your path!
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
        onSelect={() => selectedNode && handleSelectNode(selectedNode.id)}
        isOnSelectedPath={selectedNode ? selectedPath.includes(selectedNode.id) : false}
      />
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';

interface DiagramBounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

interface GeoGebraDiagramProps {
  commands: string[];
  bounds?: DiagramBounds;
  width?: number;
  height?: number;
  interactive?: boolean;
}

// Extend Window interface to include GeoGebra globals
declare global {
  interface Window {
    GGBApplet: any;
    ggbApplet?: any;
  }
}

// Validates GeoGebra commands for common errors
function validateGeoGebraCommands(commands: string[]): { valid: boolean; error?: string } {
  const definedPoints = new Set<string>();

  // Pattern to match point definitions like "A=(1,2)"
  const pointDefPattern = /^([A-Z][A-Za-z0-9]*)=\(/;

  // Extract point names used in a command
  const extractPointReferences = (cmd: string): string[] => {
    // Skip if this is a point definition
    if (pointDefPattern.test(cmd)) return [];

    // Match point names (single uppercase letter or uppercase followed by alphanumeric)
    const matches = cmd.match(/\b([A-Z][A-Za-z0-9]*)\b/g) || [];
    return matches;
  };

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i].trim();

    // Check if this is a point definition
    const pointDefMatch = cmd.match(pointDefPattern);
    if (pointDefMatch) {
      const pointName = pointDefMatch[1];
      definedPoints.add(pointName);
      continue;
    }

    // Check for forbidden commands
    if (cmd.startsWith('Point(') || cmd.includes('Point(')) {
      return {
        valid: false,
        error: `Command ${i + 1} uses forbidden Point() function: "${cmd}". Use direct assignment like A=(x,y) instead.`
      };
    }
    if (cmd.startsWith('Label(') || cmd.includes('Label(')) {
      return {
        valid: false,
        error: `Command ${i + 1} uses forbidden Label() function: "${cmd}". Point labels appear automatically.`
      };
    }
    if (cmd.startsWith('draw(') || cmd.includes('draw(')) {
      return {
        valid: false,
        error: `Command ${i + 1} uses forbidden draw() function: "${cmd}". This is Asymptote syntax, not GeoGebra.`
      };
    }

    // Check if all referenced points are defined
    const referencedPoints = extractPointReferences(cmd);
    for (const point of referencedPoints) {
      if (!definedPoints.has(point)) {
        return {
          valid: false,
          error: `Command ${i + 1} references undefined point "${point}": "${cmd}". Define ${point}=(x,y) before using it.`
        };
      }
    }
  }

  return { valid: true };
}

export function GeoGebraDiagram({
  commands,
  bounds,
  width = 600,
  height = 400,
  interactive = false,
}: GeoGebraDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const appletIdRef = useRef(`ggb-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    console.log('[GeoGebra] Component mounted with commands:', commands);
    console.log('[GeoGebra] Bounds:', bounds);

    if (!commands || commands.length === 0) {
      console.log('[GeoGebra] No commands provided, skipping render');
      setIsLoading(false);
      return;
    }

    // Validate commands before attempting to render
    const validation = validateGeoGebraCommands(commands);
    if (!validation.valid) {
      console.error('[GeoGebra] Command validation failed:', validation.error);
      setError(validation.error || 'Invalid GeoGebra commands');
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const loadGeoGebra = async () => {
      try {
        // Load GeoGebra API script if not already loaded
        if (!window.GGBApplet) {
          const script = document.createElement('script');
          script.src = 'https://www.geogebra.org/apps/deployggb.js';
          script.async = true;

          await new Promise<void>((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load GeoGebra API'));
            document.head.appendChild(script);
          });
        }

        if (!isMounted) return;

        // Create GeoGebra applet
        const appletId = appletIdRef.current;
        const parameters = {
          appName: 'classic',
          width,
          height,
          showToolBar: false,
          showMenuBar: false,
          showAlgebraInput: false,
          showResetIcon: false,
          enableRightClick: false,
          enableShiftDragZoom: interactive,
          enableLabelDrags: interactive,
          showFullscreenButton: false,
          scale: 1,
          disableAutoScale: false,
          allowUpscale: false,
          appletOnLoad: (api: any) => {
            if (!isMounted) return;

            appletRef.current = api;

            try {
              // Set view bounds if provided
              if (bounds) {
                api.setCoordSystem(
                  bounds.xmin,
                  bounds.xmax,
                  bounds.ymin,
                  bounds.ymax
                );
              }

              // Execute GeoGebra commands
              console.log(`[GeoGebra] Executing ${commands.length} commands...`);
              for (const cmd of commands) {
                try {
                  console.log(`[GeoGebra] Executing: ${cmd}`);
                  const success = api.evalCommand(cmd);
                  if (!success) {
                    console.warn(`[GeoGebra] Command failed: ${cmd}`);
                  } else {
                    console.log(`[GeoGebra] Command succeeded: ${cmd}`);
                  }
                } catch (cmdError) {
                  console.error(`[GeoGebra] Error executing command "${cmd}":`, cmdError);
                }
              }
              console.log('[GeoGebra] All commands executed');

              // Make static if not interactive
              if (!interactive) {
                try {
                  const allObjects = api.getAllObjectNames();
                  for (const obj of allObjects) {
                    const objType = api.getObjectType(obj);
                    // Keep text labels visible, hide other object labels
                    if (objType !== 'text') {
                      api.setLabelVisible(obj, false);
                    }
                  }
                } catch (labelError) {
                  console.warn('Error setting label visibility:', labelError);
                }
              }

              if (isMounted) {
                setIsLoading(false);
              }
            } catch (err) {
              console.error('Error in appletOnLoad:', err);
              if (isMounted) {
                setError(err instanceof Error ? err.message : 'Rendering failed');
                setIsLoading(false);
              }
            }
          },
        };

        // Inject applet
        if (containerRef.current && isMounted) {
          const applet = new window.GGBApplet(parameters, true);
          applet.inject(appletId);
        }
      } catch (err) {
        console.error('Error loading GeoGebra:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load GeoGebra');
          setIsLoading(false);
        }
      }
    };

    loadGeoGebra();

    // Cleanup
    return () => {
      isMounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      appletRef.current = null;
    };
  }, [commands, bounds, width, height, interactive]);

  if (!commands || commands.length === 0) {
    return null;
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 rounded-lg p-4">
        <p className="text-red-800 font-semibold">Failed to render diagram</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
        <details className="mt-2">
          <summary className="text-xs text-red-700 cursor-pointer hover:underline">
            Show commands
          </summary>
          <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-x-auto">
            {JSON.stringify(commands, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="geogebra-container relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-gray-600">Loading diagram...</span>
          </div>
        </div>
      )}
      <div
        id={appletIdRef.current}
        ref={containerRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s',
        }}
        className="border border-gray-200 rounded-lg overflow-hidden"
      />
    </div>
  );
}

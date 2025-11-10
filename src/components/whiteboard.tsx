"use client";

import React, { useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button";
import { Eraser, Pen, Trash2, Send, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface WhiteboardProps {
  onSubmit: (imageData: string) => void;
  disabled?: boolean;
}

export function Whiteboard({ onSubmit, disabled = false }: WhiteboardProps) {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [eraserMode, setEraserMode] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);

  const colors = [
    "#000000", // Black
    "#FF0000", // Red
    "#0000FF", // Blue
    "#00FF00", // Green
    "#FFA500", // Orange
    "#800080", // Purple
  ];

  const handleClear = () => {
    canvasRef.current?.clearCanvas();
  };

  const handleSubmit = async () => {
    if (!canvasRef.current) return;

    try {
      const imageData = await canvasRef.current.exportImage("png");
      onSubmit(imageData);
      // Clear the canvas after submission
      canvasRef.current.clearCanvas();
    } catch (error) {
      console.error("Error exporting whiteboard image:", error);
    }
  };

  const handlePenMode = () => {
    setEraserMode(false);
    canvasRef.current?.eraseMode(false);
  };

  const handleEraserMode = () => {
    setEraserMode(true);
    canvasRef.current?.eraseMode(true);
  };

  return (
    <div className="flex flex-col space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border rounded-md bg-background max-w-full overflow-x-hidden">
        <div className="flex items-center space-x-2">
          {/* Pen/Eraser Toggle */}
          <Button
            size="sm"
            variant={!eraserMode ? "default" : "outline"}
            onClick={handlePenMode}
            disabled={disabled}
          >
            <Pen className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={eraserMode ? "default" : "outline"}
            onClick={handleEraserMode}
            disabled={disabled}
          >
            <Eraser className="h-4 w-4" />
          </Button>

          {/* Menu Button with Color & Size Controls */}
          {!eraserMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {/* Color Selection */}
                <div className="p-3">
                  <label className="text-sm font-medium mb-2 block">Color</label>
                  <div className="grid grid-cols-3 gap-2">
                    {colors.map((color) => (
                      <button
                        key={color}
                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                          strokeColor === color
                            ? "border-primary scale-110 ring-2 ring-primary ring-offset-2"
                            : "border-gray-300"
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setStrokeColor(color)}
                        disabled={disabled}
                      />
                    ))}
                  </div>
                </div>

                <DropdownMenuSeparator />

                {/* Stroke Width */}
                <div className="p-3">
                  <label className="text-sm font-medium mb-2 block">
                    Brush Size: {strokeWidth}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="w-full"
                    disabled={disabled}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Clear</span>
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={disabled}
          >
            <Send className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Send</span>
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="border rounded-md overflow-hidden bg-white">
        <ReactSketchCanvas
          ref={canvasRef}
          strokeWidth={strokeWidth}
          strokeColor={strokeColor}
          canvasColor="#FFFFFF"
          style={{
            border: "none",
            width: "100%",
            height: "300px",
          }}
          eraserWidth={10}
        />
      </div>
    </div>
  );
}

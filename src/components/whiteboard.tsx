"use client";

import React, { useRef, useState } from "react";
import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eraser, Pen, Trash2, Send, Settings } from "lucide-react";

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
    { value: "#000000", label: "Black" },
    { value: "#FF0000", label: "Red" },
    { value: "#0000FF", label: "Blue" },
    { value: "#00FF00", label: "Green" },
    { value: "#FFA500", label: "Orange" },
    { value: "#800080", label: "Purple" },
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
      <div className="flex items-center justify-between p-2 border rounded-md bg-background">
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" disabled={disabled}>
                <Settings className="h-4 w-4 mr-1" />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-56">
              {/* Mode Selection */}
              <DropdownMenuLabel>Mode</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={eraserMode ? "eraser" : "pen"}
                onValueChange={(v) => {
                  if (v === "eraser") {
                    handleEraserMode();
                  } else {
                    handlePenMode();
                  }
                }}
              >
                <DropdownMenuRadioItem value="pen">
                  <Pen className="h-4 w-4 mr-2" />
                  Pen
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="eraser">
                  <Eraser className="h-4 w-4 mr-2" />
                  Eraser
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />

              {/* Color Selection */}
              {!eraserMode && (
                <>
                  <DropdownMenuLabel>Color</DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <div className="flex gap-2 justify-center">
                      {colors.map((color) => (
                        <button
                          key={color.value}
                          className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                            strokeColor === color.value
                              ? "border-primary ring-2 ring-primary ring-offset-1"
                              : "border-gray-300"
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => setStrokeColor(color.value)}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Size Selection */}
                  <DropdownMenuLabel>Size</DropdownMenuLabel>
                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="10"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium w-6 text-right">{strokeWidth}</span>
                    </div>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={disabled}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={disabled}
          >
            <Send className="h-4 w-4 mr-1" />
            Send
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

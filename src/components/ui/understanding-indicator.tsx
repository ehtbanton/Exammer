import React from 'react';

interface UnderstandingIndicatorProps {
  percentage: number;
  size?: 'sm' | 'md' | 'lg';
}

export function UnderstandingIndicator({ percentage, size = 'md' }: UnderstandingIndicatorProps) {
  const sizes = {
    sm: { circle: 32, fontSize: 'text-sm', letterSize: 16, stroke: 4 },
    md: { circle: 40, fontSize: 'text-base', letterSize: 20, stroke: 6 },
    lg: { circle: 48, fontSize: 'text-lg', letterSize: 24, stroke: 6 }
  };

  const config = sizes[size];
  const radius = (config.circle - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-2">
      <div className="relative" style={{ width: config.circle, height: config.circle }}>
        {/* SVG for circular progress */}
        <svg
          className="transform -rotate-90"
          width={config.circle}
          height={config.circle}
        >
          {/* Background circle (black) */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill="black"
          />

          {/* Progress ring (white) */}
          <circle
            cx={config.circle / 2}
            cy={config.circle / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeWidth={config.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-300"
          />
        </svg>

        {/* Bold capital U centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-white font-bold"
            style={{ fontSize: config.letterSize, lineHeight: 1 }}
          >
            U
          </span>
        </div>
      </div>

      {/* Percentage only */}
      <div className={`${config.fontSize} font-bold text-black`}>
        {percentage.toFixed(1)}%
      </div>
    </div>
  );
}

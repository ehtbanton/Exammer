import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

export default function WorkspaceLoading() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Asymptotic progress - approaches 100% but never quite reaches it
    // Speed is proportional to distance remaining (exponential decay)
    // When twice as close, moves half as fast
    let animationFrameId: number;

    const animate = () => {
      setProgress((prev) => {
        const target = 100;
        const easingFactor = 0.008; // Slower movement - moves 0.8% of remaining distance each frame
        const remaining = target - prev;
        return prev + remaining * easingFactor;
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="mb-12">
      <Card className="text-center py-8">
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Workspace loading...
          </p>
          <div className="max-w-md mx-auto">
            <Progress value={progress} className="h-2" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useEffect, useState } from 'react';

export default function WorkspaceLoading() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate progress from 0 to 90% while loading
    // We don't go to 100% until data actually loads
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return 90; // Cap at 90%
        return prev + 10;
      });
    }, 200);

    return () => clearInterval(timer);
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

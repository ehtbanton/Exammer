'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Terminal, MessageSquare, Settings, BarChart } from 'lucide-react';

export default function AdminPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage and monitor your Exammer application
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Server Logs */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Server Logs
            </CardTitle>
            <CardDescription>
              View live server logs and debug information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/logs">
                View Logs
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Feedback Management */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Feedback
            </CardTitle>
            <CardDescription>
              Review and manage user feedback and bug reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/feedback">
                View Feedback
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Placeholder for future features */}
        <Card className="hover:shadow-lg transition-shadow opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart className="h-5 w-5" />
              Analytics
            </CardTitle>
            <CardDescription>
              View application usage and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" disabled>
              <span>Coming Soon</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Settings
            </CardTitle>
            <CardDescription>
              Configure application settings and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" disabled>
              <span>Coming Soon</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

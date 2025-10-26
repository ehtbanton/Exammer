'use client';

export function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-4xl w-full space-y-8 p-16 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-6xl font-bold text-gray-900">Access Pending</h2>
          <p className="mt-4 text-2xl text-gray-600">
            Let Anton know you have signed up for a trial, and he will give you access to the main app! Then refresh your page once he's done.
          </p>
        </div>
      </div>
    </div>
  );
}

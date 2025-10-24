'use client';

export function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-4 text-gray-600">
            Your account is pending approval. Please wait for an administrator to grant you access.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            You will be able to access the application once your access level has been updated.
          </p>
        </div>
      </div>
    </div>
  );
}

import LoadingSpinner from "./LoadingSpinner";

export default function PageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <LoadingSpinner className="w-12 h-12 text-primary" />
    </div>
  );
}

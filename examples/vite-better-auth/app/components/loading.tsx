export const LoadingSkeleton = () => (
  <div className="flex justify-center items-center min-h-[60vh] w-full">
    <div className="w-full max-w-md space-y-4 p-6">
      <div className="h-8 bg-muted rounded animate-pulse w-3/4 mx-auto" />
      <div className="space-y-3">
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="h-10 bg-muted rounded animate-pulse w-1/2" />
      </div>
    </div>
  </div>
);

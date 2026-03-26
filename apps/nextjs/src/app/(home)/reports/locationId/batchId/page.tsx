import { Suspense } from "react";

import BatchContent from "./BatchContent";

export default function BatchDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <BatchContent />
    </Suspense>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  // One retry, so a down API reaches the error state and its Retry quickly (RS-01).
  // Mutations never retry on their own: the screen shows the error and a way to retry.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1 }, mutations: { retry: 0 } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}

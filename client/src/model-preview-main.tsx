import { createRoot } from "react-dom/client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { COOKIE_NAME } from "@shared/const";
import { trpc } from "./lib/trpc";
import { AccountSessionProvider } from "./components/AccountSession";
import EtchLive from "./pages/EtchLive";
import "./index.css";

/** The preview shares the site's authenticated API; it never grants /live access. */
function ModelPreview() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  const [client] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          transformer: superjson,
          headers() {
            try {
              const raw = sessionStorage.getItem("manus-cookie");
              const prefix = `${COOKIE_NAME}=`;
              const token = raw
                ?.split(";")
                .find(part => part.trim().startsWith(prefix))
                ?.trim()
                .slice(prefix.length);
              if (token) return { Authorization: `Bearer ${token}` };
            } catch {
              /* Cookie authentication remains available when storage is blocked. */
            }
            return {};
          },
          fetch(input, init) {
            return globalThis.fetch(input, { ...init, credentials: "include" });
          },
        }),
      ],
    })
  );
  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AccountSessionProvider>
          <EtchLive />
        </AccountSessionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const root = document.getElementById("root");
if (root) createRoot(root).render(<ModelPreview />);

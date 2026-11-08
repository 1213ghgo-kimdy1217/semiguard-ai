import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import { RECOVERY_QA_BUILD } from "./lib/recoveryQa";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  if (RECOVERY_QA_BUILD) {
    window.location.replace("/login");
    return;
  }
  startLogin();
};

const isTemporaryTransportResponse = (error: unknown) =>
  error instanceof TRPCClientError
  && error.message.includes("Unexpected token '<'");

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const path = event.query.queryKey?.[0];
    if (Array.isArray(path) && path.length === 2 && path[0] === "training" && path[1] === "shared") {
      // The shared-record view owns its sign-in/invalid-link recovery. Its
      // transport error may retain the bearer link; never log that object.
      console.warn("[Shared Training] Record could not be loaded.");
      return;
    }
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    if (isTemporaryTransportResponse(error)) {
      console.warn("[API Query Temporary Transport Error]", error);
    } else {
      console.error("[API Query Error]", error);
    }
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const key = event.mutation.options.mutationKey;
    if (Array.isArray(key?.[0]) && key[0][0] === "training" && key[0][1] === "coach") {
      // The coach handles an expired session inline so the learner can keep
      // the current review and sign in separately. Do not log answer context.
      console.warn("[Judgment Coach] Request could not be completed.");
      return;
    }
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    // Recovery failures can involve a one-time credential. Never print the
    // transport error object, which can contain request context, to the console.
    if (Array.isArray(key?.[0]) && key[0][0] === "accountRecovery") {
      console.warn("[Account Recovery] Request could not be completed.");
      return;
    }
    if (isTemporaryTransportResponse(error)) {
      console.warn("[API Mutation Temporary Transport Error]", error);
    } else {
      console.error("[API Mutation Error]", error);
    }
  }
});

const rpcTransport = {
  url: "/api/trpc",
  transformer: superjson,
  headers(): Record<string, string> {
    // Preview auto-login fallback: when the browser blocks iframe cookies
    // (Safari ITP / private browsing / WebView), the runtime mirrors the
    // session into sessionStorage so we can forward it as a Bearer token.
    // The regular OAuth cookie flow keeps working and takes priority server-side.
    try {
      const raw = sessionStorage.getItem("manus-cookie");
      if (raw) {
        const prefix = `${COOKIE_NAME}=`;
        const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
        const token = pair?.trim().slice(prefix.length);
        if (token) return { Authorization: `Bearer ${token}` };
      }
    } catch {
      // sessionStorage unavailable
    }
    return {};
  },
  fetch(input: RequestInfo | URL, init?: RequestInit) {
    return globalThis.fetch(input, { ...init, credentials: "include" });
  },
};

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: op => op.path === "training.shared",
      // Carry the share credential in the request body, away from URL logs.
      true: httpLink({ ...rpcTransport, methodOverride: "POST" }),
      false: httpBatchLink(rpcTransport),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

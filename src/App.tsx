import { Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { lazyWithRetry } from "@/lib/lazy-with-retry";

const Admision = lazyWithRetry(() => import("./pages/Admision"));
const AdmisionIntento = lazyWithRetry(() => import("./pages/AdmisionIntento"));
const AdmisionTemas = lazyWithRetry(() => import("./pages/AdmisionTemas"));

// Los datos son locales: no hay red que reintentar ni pestaña que refrescar al volver.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function Cargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" role="status" aria-label="Cargando" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <BrowserRouter>
          <Suspense fallback={<Cargando />}>
            <Routes>
              <Route path="/" element={<Navigate to="/admision" replace />} />
              <Route path="/admision" element={<Admision />} />
              <Route path="/admision/intento/:id" element={<AdmisionIntento />} />
              <Route path="/admision/temas" element={<AdmisionTemas />} />
              <Route path="*" element={<Navigate to="/admision" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

import { EntradaGate } from "@/components/entrada/EntradaGate";
import { Suspense, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { lazyWithRetry } from "@/lib/lazy-with-retry";
import { SessionGate } from '@/components/system/SessionGate';
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";

const Admision = lazyWithRetry(() => import("./pages/Admision"));
const AdmisionIntento = lazyWithRetry(() => import("./pages/AdmisionIntento"));
const AdmisionTemas = lazyWithRetry(() => import("./pages/AdmisionTemas"));

const Aprender = lazyWithRetry(() => import('./pages/Aprender'));
const Cursos = lazyWithRetry(() => import('./pages/Cursos'));
const Tutor = lazyWithRetry(() => import("./pages/Tutor"));

// Sin reintentos de escrituras implícitos: la API gestiona idempotencia y errores.
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

function getInitialWelcomeState(): boolean {
  try {
    return sessionStorage.getItem("calibra_welcome_seen_v1") !== "true";
  } catch {
    return false;
  }
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState(getInitialWelcomeState);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        {showWelcome ? <WelcomeScreen onComplete={() => setShowWelcome(false)} /> : <BrowserRouter>
          <SessionGate><EntradaGate><Suspense fallback={<Cargando />}>
            <Routes>
              <Route path="/" element={<Navigate to="/admision" replace />} />
              <Route path="/aprender" element={<Aprender />} />
              <Route path="/aprender/:id" element={<Aprender />} />
              <Route path="/tutor" element={<Tutor />} />
              <Route path="/tutor/:id" element={<Tutor />} />
              <Route path="/cursos" element={<Cursos />} />
              <Route path="/cursos/:cursoId" element={<Cursos />} />
              <Route path="/cursos/:cursoId/materiales/:documentoId" element={<Cursos />} />
              <Route path="/admision" element={<Admision />} />
              <Route path="/admision/intento/:id" element={<AdmisionIntento />} />
              <Route path="/admision/temas" element={<AdmisionTemas />} />
              <Route path="*" element={<Navigate to="/admision" replace />} />
            </Routes>
          </Suspense></EntradaGate></SessionGate>
        </BrowserRouter>}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

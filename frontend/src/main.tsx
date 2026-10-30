import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { recargarUnaVez } from "./lib/lazy-with-retry";
import "./fuentes.css";
import "./index.css";
// Después de index.css: sus piezas tienen que poder ganar a las utilidades de igual peso.
import "./arcade.css";

// Tras publicar una versión, una pestaña abierta pide chunks con el hash viejo, que ya no existen:
// se recarga una vez para traer el index.html nuevo.
window.addEventListener("vite:preloadError", (evento) => {
  if (recargarUnaVez()) evento.preventDefault();
});

createRoot(document.getElementById("root")!).render(<App />);

import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";
import { Toaster } from '@/components/ui/toaster';
import { AccessibilityProvider } from "./lib/accessibilityContext";

// Import custom fonts
import '@fontsource/rozha-one';
import '@fontsource/poppins/600.css'; // Import SemiBold variant

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AccessibilityProvider>
      <App />
      <Toaster />
    </AccessibilityProvider>
  </QueryClientProvider>
);

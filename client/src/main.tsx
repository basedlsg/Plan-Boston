import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { Toaster } from '@/components/ui/toaster';

// Import custom fonts
import '@fontsource/rozha-one';
import '@fontsource/poppins/600.css'; // Import SemiBold variant

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
  </>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./shared/theme/fonts";
import "./shared/theme/global.css";
import "./shared/theme/components.css";
import App from "./App";
// After every other stylesheet, so the phone rules win on a phone (they apply nowhere else).
import "./shared/theme/phone.css";
import { SessionGate } from "./account/SessionGate";
import { makeQueryClient } from "./shared/queryClient";
import { ToastProvider } from "./shared/Toast";
import { followDeviceTheme } from "./shared/theme/mode";

// The theme choice is mounted only while the user menu is open, so following the device is app-wide.
followDeviceTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={makeQueryClient()}>
      <BrowserRouter>
        <ToastProvider>
          <SessionGate>
            <App />
          </SessionGate>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

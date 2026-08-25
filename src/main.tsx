import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./lib/AuthContext";
import { ActionNoticeProvider } from "./lib/ActionNoticeContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ActionNoticeProvider>
          <App />
        </ActionNoticeProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

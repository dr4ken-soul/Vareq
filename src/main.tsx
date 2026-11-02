import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./styles.css";

const appId = import.meta.env.VITE_PRIVY_APP_ID?.trim();
const app = <BrowserRouter><App /></BrowserRouter>;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {appId ? <PrivyProvider appId={appId} config={{
      loginMethods: ["google", "wallet"],
      appearance: { theme: "light", accentColor: "#A34326" },
      embeddedWallets: { ethereum: { createOnLogin: "off" } },
    }}>{app}</PrivyProvider> : app}
  </React.StrictMode>,
);
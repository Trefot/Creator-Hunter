import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter";
import { Startup } from "./features/startup/Startup";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Startup />
  </React.StrictMode>,
);

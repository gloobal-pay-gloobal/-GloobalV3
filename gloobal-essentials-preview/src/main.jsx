import React from "react";
import ReactDOM from "react-dom/client";
import GloobalArtifactRoot from "./GloobalApp.jsx";
// Tailwind's utilities plus the app-wide reset. The screens mix inline
// styles with Tailwind classes (flex, px-5, rounded-2xl, text-slate-*),
// so without this stylesheet those classes are inert and the layouts
// collapse to plain block flow.
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GloobalArtifactRoot />
  </React.StrictMode>
);

import { ExtensionWrapper } from "owlbear-utils";
import React from "react";
import ReactDOM from "react-dom/client";
import "../../assets/style.css";
import { install } from "../install";
import { startSyncing } from "../state/startSyncing";
import { usePlayerStorage } from "../state/usePlayerStorage";
import { Action } from "./Action";

// Enable here or in background
install();

document.addEventListener("DOMContentLoaded", () => {
    const root = ReactDOM.createRoot(document.getElementById("reactApp")!);
    root.render(
        <React.StrictMode>
            <ExtensionWrapper
                startSyncing={startSyncing}
                useStoreFn={usePlayerStorage}
            >
                <Action />
            </ExtensionWrapper>
        </React.StrictMode>,
    );
});

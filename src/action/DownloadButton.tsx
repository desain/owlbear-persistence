import Download from "@mui/icons-material/Download";
import IconButton from "@mui/material/IconButton";
import type React from "react";
import type { PersistedToken } from "../state/PersistedToken";
import { usePlayerStorage } from "../state/usePlayerStorage";

const handleDownload = (tokens: PersistedToken[]) => {
    const blob = new Blob([JSON.stringify(tokens, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tokens-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

export const DownloadButton: React.FC = () => {
    const tokens = usePlayerStorage((s) => s.tokens);
    return (
        <IconButton
            title="Download all tokens"
            onClick={() => handleDownload(tokens)}
        >
            <Download />
        </IconButton>
    );
};

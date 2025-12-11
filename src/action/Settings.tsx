import ArrowBack from "@mui/icons-material/ArrowBack";
import HelpOutline from "@mui/icons-material/HelpOutline";
import {
    Box,
    CardHeader,
    FormControlLabel,
    IconButton,
    Switch,
    Tooltip,
    Typography,
} from "@mui/material";
import type React from "react";
import { version } from "../../package.json";
import { EXTENSION_NAME } from "../constants";
import { usePlayerStorage } from "../state/usePlayerStorage";

interface SettingsProps {
    onBack: VoidFunction;
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const contextMenuEnabled = usePlayerStorage(
        (store) => store.contextMenuEnabled,
    );
    const setContextMenuEnabled = usePlayerStorage(
        (store) => store.setContextMenuEnabled,
    );
    return (
        <Box sx={{ p: 2, minWidth: 300 }}>
            <CardHeader
                title={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography
                            sx={{
                                fontSize: "1.125rem",
                                fontWeight: "bold",
                                lineHeight: "32px",
                                color: "text.primary",
                            }}
                        >
                            Settings
                        </Typography>
                        <Tooltip title="Help">
                            <IconButton
                                component="a"
                                href="https://github.com/desain/owlbear-persistence"
                                target="_blank"
                                rel="noopener noreferrer"
                                size="small"
                            >
                                <HelpOutline fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                }
                action={
                    <Tooltip title="Back">
                        <IconButton onClick={onBack}>
                            <ArrowBack />
                        </IconButton>
                    </Tooltip>
                }
            />
            <FormControlLabel
                control={
                    <Switch
                        checked={contextMenuEnabled}
                        onChange={(e) =>
                            setContextMenuEnabled(e.target.checked)
                        }
                    />
                }
                label="Enable Context Menu"
                sx={{ mb: 2 }}
            />
            <Typography
                color="textSecondary"
                variant="subtitle1"
                sx={{ mt: 2 }}
            >
                {EXTENSION_NAME} version {version}
            </Typography>
        </Box>
    );
};

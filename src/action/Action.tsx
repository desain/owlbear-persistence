import { Close, Search, Settings } from "@mui/icons-material";
import {
    Alert,
    Box,
    Button,
    CardHeader,
    Divider,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import type { FuzzyResult, Range } from "@nozbe/microfuzz";
import { useFuzzySearchList } from "@nozbe/microfuzz/react";
import { filesize } from "filesize";
import sizeof from "object-sizeof";
import { sum, useActionResizer, useRehydrate } from "owlbear-utils";
import React, { useMemo, useState } from "react";
import { EXTENSION_NAME } from "../constants";
import {
    persistedTokenGetName,
    persistedTokenKey,
    type PersistedToken,
} from "../state/PersistedToken";
import { usePlayerStorage } from "../state/usePlayerStorage";
import { DownloadButton } from "./DownloadButton";
import { Settings as SettingsPanel } from "./Settings";
import { TokenCard } from "./TokenCard";
import { UploadButton } from "./UploadButton";

export const Action: React.FC = () => {
    const [showSettings, setShowSettings] = useState(false);
    const [expanded, setExpanded] = useState<string | null>();
    const [query, setQuery] = useState("");
    const [searchExpanded, setSearchExpanded] = useState(false);

    const BASE_HEIGHT = 200;
    const MAX_HEIGHT = 700;
    const box = useActionResizer(BASE_HEIGHT, MAX_HEIGHT);
    useRehydrate(usePlayerStorage);

    const role = usePlayerStorage((s) => s.role);
    const tokens = usePlayerStorage((s) => s.tokens);
    const sizes = useMemo(
        () => new Map(tokens.map((t) => [persistedTokenKey(t), sizeof(t)])),
        [tokens],
    );
    const totalSize = sum(sizes.values());

    const filtered = useFuzzySearchList<
        PersistedToken,
        { token: PersistedToken; highlightRanges?: Range[] }
    >({
        list: tokens,
        queryText: query,
        getText: (t) => [persistedTokenGetName(t)],
        mapResultItem: (res: FuzzyResult<PersistedToken>) => ({
            token: res.item,
            highlightRanges: res.matches[0] ?? undefined,
        }),
        strategy: "smart",
    });

    return role === "PLAYER" ? (
        <Alert severity="warning">
            This extension is for the GM's use only.
        </Alert>
    ) : (
        <Box ref={box}>
            <CardHeader
                title={EXTENSION_NAME}
                subheader={`${filesize(totalSize)} / 5MB used`}
                slotProps={{
                    title: {
                        sx: {
                            fontSize: "1.125rem",
                            fontWeight: "bold",
                            lineHeight: "32px",
                            color: "text.primary",
                        },
                    },
                }}
                action={
                    <IconButton
                        title="Settings"
                        onClick={() => setShowSettings(true)}
                    >
                        <Settings />
                    </IconButton>
                }
            />
            <Divider sx={{ mb: 1 }} />

            <Stack spacing={1} sx={{ p: 0 }}>
                <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 1, minHeight: 40 }}
                >
                    {searchExpanded ? (
                        <TextField
                            fullWidth
                            autoFocus
                            size="small"
                            placeholder="Search tokens"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            slotProps={{
                                input: {
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <Search fontSize="small" />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setSearchExpanded(false);
                                                    setQuery("");
                                                }}
                                            >
                                                <Close fontSize="small" />
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                },
                            }}
                        />
                    ) : (
                        <>
                            <IconButton
                                title="Search for tokens"
                                onClick={() => setSearchExpanded(true)}
                            >
                                <Search />
                            </IconButton>
                            <Box sx={{ flexGrow: 1 }} />
                            <DownloadButton />
                            <UploadButton />
                        </>
                    )}
                </Stack>

                {tokens.length === 0 ? (
                    <Typography color="text.secondary">
                        No tokens saved. Right click a token to persist it.
                    </Typography>
                ) : filtered.length === 0 ? (
                    <Typography color="text.secondary">
                        No results found.
                    </Typography>
                ) : (
                    <Stack spacing={2}>
                        {filtered.map(({ token, highlightRanges }) => {
                            const key = persistedTokenKey(token);
                            return (
                                <TokenCard
                                    key={key}
                                    expanded={expanded === key}
                                    setExpanded={setExpanded}
                                    token={token}
                                    size={sizes.get(key) ?? 0}
                                    highlightRanges={highlightRanges}
                                />
                            );
                        })}
                        <Typography color="textSecondary">
                            Right click a token to persist it.
                        </Typography>
                    </Stack>
                )}

                {import.meta.env.DEV && (
                    <Button
                        onClick={() =>
                            console.log(usePlayerStorage.getState().tokens)
                        }
                    >
                        Debug Tokens
                    </Button>
                )}
            </Stack>
            <Box
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    transition: "transform 0.2s ease-in-out",
                    transform: showSettings
                        ? "translateX(0)"
                        : "translateX(-100%)",
                }}
            >
                <Paper elevation={2} sx={{ height: "100%" }}>
                    <SettingsPanel onBack={() => setShowSettings(false)} />
                </Paper>
            </Box>
        </Box>
    );
};

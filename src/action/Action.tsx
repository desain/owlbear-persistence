import {
    Close,
    DeleteOutline,
    Download,
    ExpandMore,
    Group,
    Person,
    Search,
    Settings,
    Upload,
    Warning,
} from "@mui/icons-material";
import Edit from "@mui/icons-material/Edit";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Badge,
    Box,
    Button,
    CardHeader,
    CardMedia,
    Divider,
    IconButton,
    InputAdornment,
    Paper,
    Stack,
    Switch,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from "@mui/material";
import type { FuzzyResult, Range } from "@nozbe/microfuzz";
import { Highlight, useFuzzySearchList } from "@nozbe/microfuzz/react";
import type { ImageContent } from "@owlbear-rodeo/sdk";
import OBR from "@owlbear-rodeo/sdk";
import { filesize } from "filesize";
import sizeof from "object-sizeof";
import {
    complain,
    Control,
    getId,
    sum,
    useActionResizer,
    useRehydrate,
} from "owlbear-utils";
import { useMemo, useRef, useState } from "react";
import { EXTENSION_NAME } from "../constants";
import {
    isPersistedTokenArray,
    persistedTokenGetLastModified,
    persistedTokenGetName,
    persistedTokenKey,
    type PersistedToken,
    type PersistenceType,
} from "../state/PersistedToken";
import { usePlayerStorage } from "../state/usePlayerStorage";
import { isToken } from "../Token";
import { Settings as SettingsPanel } from "./Settings";

function formatTimestamp(ts?: Date) {
    if (!ts) {
        return "";
    }
    try {
        return ts.toLocaleString();
    } catch {
        return String(ts);
    }
}

function TokenCard({
    token,
    size,
    expanded,
    setExpanded,
    highlightRanges,
}: {
    token: PersistedToken;
    size: number;
    expanded: boolean;
    setExpanded: (expanded: string | null) => void;
    highlightRanges?: Range[];
}) {
    const setType = usePlayerStorage((s) => s.setType);
    const setName = usePlayerStorage((s) => s.setTokenName);
    const setRestoreAttachments = usePlayerStorage(
        (s) => s.setTokenRestoreAttachments,
    );
    const removeToken = usePlayerStorage((s) => s.removeToken);
    const keyUsage = usePlayerStorage((s) => s.keyUsage);

    const key = persistedTokenKey(token);
    const name = persistedTokenGetName(token);

    async function handleSelect(url: ImageContent["url"]) {
        if (!usePlayerStorage.getState().sceneReady) {
            // can't focus a token if the scene is gone
            return;
        }
        const items = await OBR.scene.items.getItems(
            (item) => isToken(item) && item.image.url === url,
        );
        if (items.length > 0) {
            const bounds = await OBR.scene.items.getItemBounds(
                items.map(getId),
            );
            await Promise.all([
                OBR.player.select(items.map(getId)),
                OBR.viewport.animateToBounds(bounds),
            ]);
        }
    }

    const image = (
        <CardMedia
            component="img"
            image={key}
            alt={name}
            sx={{
                width: 48,
                height: 48,
            }}
            onClick={(e) => {
                e.stopPropagation();
                return handleSelect(key);
            }}
        />
    );

    const hasWarning = token.type === "UNIQUE" && (keyUsage.get(key) ?? 0) > 1;

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) => setExpanded(isExpanded ? key : null)}
        >
            <AccordionSummary
                expandIcon={<ExpandMore />}
                slotProps={{ content: { sx: { m: 0 } } }}
            >
                <Stack direction="row" alignItems="center">
                    {hasWarning ? (
                        <Badge
                            color="warning"
                            overlap="circular"
                            badgeContent={<Warning fontSize="small" />}
                        >
                            {image}
                        </Badge>
                    ) : (
                        image
                    )}
                    <CardHeader
                        title={
                            highlightRanges ? (
                                <Highlight
                                    text={name}
                                    ranges={highlightRanges}
                                />
                            ) : (
                                name
                            )
                        }
                        subheader={filesize(size)}
                        slotProps={{
                            title: {
                                variant: "body1",
                            },
                            subheader: {
                                variant: "caption",
                            },
                        }}
                    />
                </Stack>
            </AccordionSummary>
            <AccordionDetails>
                <Stack spacing={1}>
                    {hasWarning && (
                        <Alert severity="warning">
                            The scene contains more than one of this unique
                            token. The persisted token will not update.
                        </Alert>
                    )}
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Control label="Persistence">
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={token.type}
                                onChange={(_, value: PersistenceType) => {
                                    if (value) {
                                        setType(key, value);
                                    }
                                }}
                            >
                                <ToggleButton
                                    value={"UNIQUE" satisfies PersistenceType}
                                >
                                    <Tooltip title="Unique token (updates to the token are saved immediately)">
                                        <Person fontSize="small" />
                                    </Tooltip>
                                </ToggleButton>
                                <ToggleButton
                                    value={"TEMPLATE" satisfies PersistenceType}
                                >
                                    <Tooltip title="Template token (template must be updated manually)">
                                        <Group fontSize="small" />
                                    </Tooltip>
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Control>
                        <Control label="Rename">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const newName = prompt("New name:", name);
                                    if (newName) {
                                        if (newName.length < 50) {
                                            setName(key, newName);
                                        }
                                    }
                                }}
                                aria-label="remove token"
                            >
                                <Edit fontSize="small" />
                            </IconButton>
                        </Control>
                        <Control label="Delete">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    const ok = window.confirm(
                                        `Stop persisting token "${name}"?`,
                                    );
                                    if (ok) {
                                        removeToken(key);
                                    }
                                }}
                                aria-label="remove token"
                            >
                                <DeleteOutline fontSize="small" />
                            </IconButton>
                        </Control>
                    </Stack>
                    <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        <Control label="Save attachments?">
                            <Switch
                                checked={token.restoreAttachments ?? true}
                                onChange={(_e, checked) =>
                                    setRestoreAttachments(key, checked)
                                }
                            />
                        </Control>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Last modified{" "}
                        {formatTimestamp(persistedTokenGetLastModified(token))}
                    </Typography>
                </Stack>
            </AccordionDetails>
        </Accordion>
    );
}

export function Action() {
    const [showSettings, setShowSettings] = useState(false);
    const [expanded, setExpanded] = useState<string | null>();
    const [query, setQuery] = useState("");
    const [searchExpanded, setSearchExpanded] = useState(false);
    const uploadRef = useRef<HTMLInputElement>(null);

    const BASE_HEIGHT = 50;
    const MAX_HEIGHT = 700;
    const box = useActionResizer(BASE_HEIGHT, MAX_HEIGHT);
    useRehydrate(usePlayerStorage);

    const role = usePlayerStorage((s) => s.role);
    const tokens = usePlayerStorage((s) => s.tokens);
    const importTokens = usePlayerStorage((s) => s.importTokens);
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

    const handleDownload = () => {
        const blob = new Blob([JSON.stringify(tokens, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "owlbear-persisted-tokens.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result;
            if (typeof text === "string") {
                try {
                    const importedTokens: unknown = JSON.parse(text);
                    if (!isPersistedTokenArray(importedTokens)) {
                        throw Error(
                            "Invalid JSON file; must contain persisted token list.",
                        );
                    }
                    const currentTokens = usePlayerStorage.getState().tokens;
                    const currentKeys = new Set(
                        currentTokens.map(persistedTokenKey),
                    );
                    const collision = importedTokens.some((t) =>
                        currentKeys.has(persistedTokenKey(t)),
                    );

                    if (collision) {
                        if (
                            !window.confirm(
                                "Some tokens will be replaced. Continue?",
                            )
                        ) {
                            return;
                        }
                    }
                    importTokens(importedTokens);
                } catch (e) {
                    complain(e);
                }
            }
        };
        reader.readAsText(file);
        // reset input
        event.target.value = "";
    };

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
                    <IconButton onClick={() => setShowSettings(true)}>
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
                            <IconButton onClick={() => setSearchExpanded(true)}>
                                <Search />
                            </IconButton>
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton onClick={handleDownload}>
                                <Download />
                            </IconButton>
                            <IconButton
                                onClick={() => uploadRef.current?.click()}
                            >
                                <Upload />
                            </IconButton>
                            <input
                                type="file"
                                accept=".json"
                                ref={uploadRef}
                                style={{ display: "none" }}
                                onChange={handleUpload}
                            />
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
}

import {
    DeleteOutline,
    ExpandMore,
    Group,
    Person,
    Search,
    Settings,
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
    Control,
    getId,
    sum,
    useActionResizer,
    useRehydrate,
} from "owlbear-utils";
import { useMemo, useState } from "react";
import { EXTENSION_NAME } from "../constants";
import {
    usePlayerStorage,
    type PersistedToken,
    type PersistenceType,
} from "../state/usePlayerStorage";
import { isToken } from "../Token";
import { Settings as SettingsPanel } from "./Settings";

function formatTimestamp(ts?: number) {
    if (!ts) {
        return "";
    }
    try {
        const d = new Date(ts);
        return d.toLocaleString();
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
    const urlUsage = usePlayerStorage((s) => s.urlUsage);

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
            image={token.imageUrl}
            alt={token.name}
            sx={{
                width: 48,
                height: 48,
            }}
            onClick={(e) => {
                e.stopPropagation();
                return handleSelect(token.imageUrl);
            }}
        />
    );

    const hasWarning =
        token.type === "UNIQUE" && (urlUsage.get(token.imageUrl) ?? 0) > 1;

    return (
        <Accordion
            expanded={expanded}
            onChange={(_, isExpanded) =>
                setExpanded(isExpanded ? token.imageUrl : null)
            }
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
                                    text={token.name}
                                    ranges={highlightRanges}
                                />
                            ) : (
                                token.name
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
                                onChange={(_, value) => {
                                    if (value) {
                                        setType(
                                            token.imageUrl,
                                            value as PersistenceType,
                                        );
                                    }
                                }}
                            >
                                <ToggleButton value="UNIQUE">
                                    <Tooltip title="Unique token (updates to the token are saved immediately)">
                                        <Person fontSize="small" />
                                    </Tooltip>
                                </ToggleButton>
                                <ToggleButton value="TEMPLATE">
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
                                    const newName = prompt(
                                        "New name:",
                                        token.name,
                                    );
                                    if (newName) {
                                        if (newName.length < 50) {
                                            setName(token.imageUrl, newName);
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
                                        `Remove token "${token.name}"?`,
                                    );
                                    if (ok) {
                                        removeToken(token.imageUrl);
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
                                checked={token.restoreAttachments}
                                onChange={(_e, checked) =>
                                    setRestoreAttachments(
                                        token.imageUrl,
                                        checked,
                                    )
                                }
                            />
                        </Control>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        Last modified {formatTimestamp(token.lastModified)}
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

    const BASE_HEIGHT = 50;
    const MAX_HEIGHT = 700;
    const box = useActionResizer(BASE_HEIGHT, MAX_HEIGHT);
    useRehydrate(usePlayerStorage);

    const role = usePlayerStorage((s) => s.role);
    const tokens = usePlayerStorage((s) => s.tokens);
    const sizes = useMemo(
        () => new Map(tokens.map((t) => [t.imageUrl, sizeof(t)])),
        [tokens],
    );
    const totalSize = sum(sizes.values());

    const filtered = useFuzzySearchList<
        PersistedToken,
        { token: PersistedToken; highlightRanges?: Range[] }
    >({
        list: tokens,
        queryText: query,
        getText: (item: PersistedToken) => [item.name],
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
                    <IconButton onClick={() => setShowSettings(true)}>
                        <Settings />
                    </IconButton>
                }
            />
            <Divider sx={{ mb: 1 }} />

            <Stack spacing={1} sx={{ p: 0 }}>
                <TextField
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
                        },
                    }}
                    sx={{ mb: 1 }}
                />

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
                        {filtered.map(({ token, highlightRanges }) => (
                            <TokenCard
                                key={token.imageUrl}
                                expanded={expanded === token.imageUrl}
                                setExpanded={setExpanded}
                                token={token}
                                size={sizes.get(token.imageUrl) ?? 0}
                                highlightRanges={highlightRanges}
                            />
                        ))}
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

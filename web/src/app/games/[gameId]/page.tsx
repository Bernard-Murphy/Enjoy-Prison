"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { gql, useQuery, useMutation, useSubscription } from "@apollo/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/components/comment-section";
import { ReportDialog } from "@/components/report-dialog";
import { RemoveDialog } from "@/components/remove-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Fullscreen, GitBranch, Flag, Trash2, Pencil, Archive, ArchiveRestore, Users } from "lucide-react";
import { toast } from "sonner";
import { useWebRTC } from "@/lib/hooks/useWebRTC";

const GAME_QUERY = gql`
  query GamePage($id: Int!) {
    game(id: $id) {
      id
      title
      description
      status
      hostedAt
      views
      userId
      logoUrl
      versions {
        id
        hostedAt
        isDefault
        archived
        createdAt
      }
    }
    me {
      id
      role
    }
  }
`;

const FORK_MUTATION = gql`
  mutation ForkGame($gameId: Int!) {
    forkGame(gameId: $gameId) {
      id
    }
  }
`;

const ARCHIVE_VERSION_MUTATION = gql`
  mutation ArchiveGameVersion($versionId: Int!) {
    archiveGameVersion(versionId: $versionId) {
      id
      archived
    }
  }
`;

const UNARCHIVE_VERSION_MUTATION = gql`
  mutation UnarchiveGameVersion($versionId: Int!) {
    unarchiveGameVersion(versionId: $versionId) {
      id
      archived
    }
  }
`;

const CREATE_SESSION_MUTATION = gql`
  mutation CreateSession($gameId: Int!, $mode: String) {
    createSession(gameId: $gameId, mode: $mode) {
      id
      code
      status
      mode
      players { id playerIndex role ready }
    }
  }
`;

const JOIN_SESSION_MUTATION = gql`
  mutation JoinSession($code: String!) {
    joinSession(code: $code) {
      id
      code
      status
      mode
      players { id playerIndex role ready }
    }
  }
`;

const SESSION_READY_MUTATION = gql`
  mutation SessionReady($sessionId: Int!) {
    sessionReady(sessionId: $sessionId) {
      id
      code
      status
      config
      players { id playerIndex role ready }
    }
  }
`;

const LEAVE_SESSION_MUTATION = gql`
  mutation LeaveSession($sessionId: Int!, $playerIndex: Int!) {
    leaveSession(sessionId: $sessionId, playerIndex: $playerIndex)
  }
`;

const SEND_GAME_MOVE_MUTATION = gql`
  mutation SendGameMove($sessionId: Int!, $playerIndex: Int!, $move: String!, $diceRoll: Int) {
    sendGameMove(sessionId: $sessionId, playerIndex: $playerIndex, move: $move, diceRoll: $diceRoll) {
      sessionId
      playerIndex
      move
    }
  }
`;

const SESSION_UPDATED_SUBSCRIPTION = gql`
  subscription SessionUpdated($sessionId: Int!) {
    sessionUpdated(sessionId: $sessionId) {
      id
      code
      status
      config
      players { id playerIndex role ready }
    }
  }
`;

const GAME_MOVE_SUBSCRIPTION = gql`
  subscription GameMove($sessionId: Int!) {
    gameMove(sessionId: $sessionId) {
      sessionId
      playerIndex
      move
    }
  }
`;

type GameVersion = {
  id: number;
  hostedAt: string;
  isDefault: boolean;
  archived: boolean;
  createdAt: string;
};

export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const gameId = parseInt(params.gameId as string, 10);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const [multiplayerSession, setMultiplayerSession] = useState<{
    id: number;
    code: string;
    status: string;
    mode: string;
    config?: { seed?: number; players?: { playerIndex: number; role: string; name?: string }[] };
    players: { id?: number; playerIndex: number; role: string; ready?: boolean }[];
  } | null>(null);
  const [localPlayerIndex, setLocalPlayerIndex] = useState(0);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  const { data, refetch } = useQuery(GAME_QUERY, {
    variables: { id: gameId },
    skip: isNaN(gameId),
  });
  const [forkGame] = useMutation(FORK_MUTATION);
  const [archiveVersion] = useMutation(ARCHIVE_VERSION_MUTATION, {
    onCompleted: () => refetch(),
  });
  const [unarchiveVersion] = useMutation(UNARCHIVE_VERSION_MUTATION, {
    onCompleted: () => refetch(),
  });
  const [createSession] = useMutation(CREATE_SESSION_MUTATION, {
    onCompleted: (d: { createSession: { id: number; code: string; status: string; mode: string; players: { id?: number; playerIndex: number; role: string; ready?: boolean }[] } }) => {
      setMultiplayerSession(d.createSession);
      setLocalPlayerIndex(0);
    },
    onError: () => toast.error("Failed to create session"),
  });
  const [joinSession] = useMutation(JOIN_SESSION_MUTATION, {
    onCompleted: (d: { joinSession: { id: number; code: string; status: string; mode: string; players: { id?: number; playerIndex: number; role: string; ready?: boolean }[] } }) => {
      setMultiplayerSession(d.joinSession);
      const me = d.joinSession.players.length - 1;
      setLocalPlayerIndex(me);
      setJoinCodeInput("");
      setShowJoinInput(false);
    },
    onError: () => toast.error("Failed to join session"),
  });
  const [sessionReady] = useMutation(SESSION_READY_MUTATION);
  const [leaveSession] = useMutation(LEAVE_SESSION_MUTATION, {
    onCompleted: () => setMultiplayerSession(null),
  });
  const [sendGameMove] = useMutation(SEND_GAME_MOVE_MUTATION);

  const [disconnectMessage, setDisconnectMessage] = useState<string | null>(null);

  useSubscription(SESSION_UPDATED_SUBSCRIPTION, {
    variables: { sessionId: multiplayerSession?.id ?? 0 },
    skip: multiplayerSession?.id == null,
    onData: ({ data: subData }) => {
      const session = subData?.data?.sessionUpdated;
      if (!session) return;
      setMultiplayerSession(session);
      if (session.status === "playing" && (session.players?.length ?? 0) < 2) {
        setDisconnectMessage("Opponent disconnected.");
      } else {
        setDisconnectMessage(null);
      }
      if (session.status === "playing" && session.config && iframeRef.current?.contentWindow) {
        const config = session.config as { seed?: number; players?: { playerIndex: number; role: string; name?: string }[] };
        const players = (config.players || session.players || []).map((p: { playerIndex: number; role: string }, i: number) => ({
          name: "Player " + (i + 1),
          type: i === localPlayerIndex ? "human" : "remote",
          color: i === 0 ? "#4488ff" : "#ff8844",
          symbol: i === 0 ? "X" : "O",
        }));
        iframeRef.current.contentWindow.postMessage(
          { type: "start", payload: { seed: config.seed, players, localPlayerIndex } },
          "*"
        );
      }
    },
  });

  useSubscription(GAME_MOVE_SUBSCRIPTION, {
    variables: { sessionId: multiplayerSession?.id ?? 0 },
    skip: multiplayerSession?.id == null || multiplayerSession?.mode !== "turn-based",
    onData: ({ data: subData }) => {
      const move = subData?.data?.gameMove;
      if (!move || !iframeRef.current?.contentWindow) return;
      try {
        const payload = typeof move.move === "string" ? JSON.parse(move.move) : move.move;
        iframeRef.current.contentWindow.postMessage({ type: "move", payload }, "*");
      } catch {
        iframeRef.current.contentWindow.postMessage({ type: "move", payload: move.move }, "*");
      }
    },
  });

  const webrtcConnectedRef = useRef(false);
  const webrtc = useWebRTC(
    multiplayerSession?.id ?? null,
    localPlayerIndex,
    multiplayerSession?.mode === "action"
      ? {
        onMessage: (data) => {
          try {
            const msg = JSON.parse(data);
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({ type: msg.type, payload: msg.payload ?? msg }, "*");
            }
          } catch {
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage({ type: "playerState", payload: data }, "*");
            }
          }
        },
      }
      : undefined
  );
  useEffect(() => {
    if (multiplayerSession?.mode === "action" && webrtcConnectedRef.current && !webrtc.connected) {
      setDisconnectMessage("Connection lost.");
    }
    if (multiplayerSession?.mode === "action") webrtcConnectedRef.current = webrtc.connected;
  }, [multiplayerSession?.mode, webrtc.connected]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow || !multiplayerSession?.id) return;
    const win = iframeRef.current.contentWindow;
    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (!msg || typeof msg.type !== "string") return;
      if (multiplayerSession.mode === "turn-based") {
        if (msg.type === "move") {
          sendGameMove({
            variables: {
              sessionId: multiplayerSession.id,
              playerIndex: localPlayerIndex,
              move: typeof msg.payload === "string" ? msg.payload : JSON.stringify(msg.payload || {}),
              diceRoll: msg.payload?.diceRoll ?? (msg.payload?.requestDice ? undefined : undefined),
            },
          });
        }
      } else if (multiplayerSession.mode === "action" && webrtc.connected) {
        if (msg.type === "playerState" || msg.type === "worldState") {
          webrtc.send(JSON.stringify({ type: msg.type, payload: msg.payload }));
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [multiplayerSession?.id, multiplayerSession?.mode, localPlayerIndex, sendGameMove, webrtc.connected, webrtc.send]);

  const game = data?.game;
  const me = data?.me;
  const isMod = me?.role === "janny" || me?.role === "admincel";
  const isOwner = !!me && !!game && game.userId === me.id;

  const versions = (game?.versions ?? []) as GameVersion[];
  const defaultVersion = useMemo(
    () => versions.find((v) => v.isDefault) ?? versions[0],
    [versions],
  );
  const selectedVersion =
    selectedVersionId != null
      ? versions.find((v) => v.id === selectedVersionId)
      : defaultVersion;
  const displayedHostedAt =
    selectedVersion?.hostedAt ?? game?.hostedAt ?? "";
  const showVersionDropdown = versions.length > 0;

  const handleFullscreen = () => {
    if (!iframeRef.current) return;
    if (iframeRef.current.requestFullscreen) {
      iframeRef.current.requestFullscreen();
    }
  };

  const handleFork = async () => {
    try {
      const { data: res } = await forkGame({ variables: { gameId } });
      const newId = res?.forkGame?.id;
      if (newId) {
        toast.success("Game forked!");
        window.location.href = `/create?id=${newId}`;
      }
    } catch {
      toast.error("Failed to fork");
    }
  };

  const handleRemove = async (_reason: string, _details: string) => {
    toast.info("Remove not implemented yet.");
  };

  const handleArchiveVersion = async (versionId: number) => {
    try {
      await archiveVersion({ variables: { versionId } });
      toast.success("Version archived.");
      if (selectedVersionId === versionId) {
        const next = versions.find((v) => v.id !== versionId && !v.archived) ?? versions.find((v) => v.id !== versionId);
        setSelectedVersionId(next?.id ?? null);
      }
    } catch {
      toast.error("Failed to archive.");
    }
  };

  const handleUnarchiveVersion = async (versionId: number) => {
    try {
      await unarchiveVersion({ variables: { versionId } });
      toast.success("Version unarchived.");
    } catch {
      toast.error("Failed to unarchive.");
    }
  };

  if (isNaN(gameId) || (!game && data !== undefined)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Game not found.</p>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">{game.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/create?id=${gameId}`)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              Update
            </Button>
          )}
          {game.status === "live" && displayedHostedAt && !multiplayerSession && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => createSession({ variables: { gameId, mode: "turn-based" } })}
            >
              <Users className="h-4 w-4 mr-1" />
              Play Multiplayer
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleFullscreen}>
            <Fullscreen className="h-4 w-4 mr-1" />
            Fullscreen
          </Button>
          <Button variant="outline" size="sm" onClick={handleFork}>
            <GitBranch className="h-4 w-4 mr-1" />
            Fork
          </Button>
          {isMod ? (
            <Button variant="destructive" size="sm" onClick={() => setRemoveOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1" />
              Remove
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
              <Flag className="h-4 w-4 mr-1" />
              Report
            </Button>
          )}
        </div>
      </div>

      {showVersionDropdown && versions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-sm text-muted-foreground">Version:</span>
          <Select
            value={String(selectedVersion?.id ?? "")}
            onValueChange={(v) => setSelectedVersionId(v ? parseInt(v, 10) : null)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select version" />
            </SelectTrigger>
            <SelectContent>
              {versions.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>
                  {v.isDefault ? "Default" : ""} Version {v.id}
                  {v.archived ? " (archived)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isOwner && selectedVersion &&
            (selectedVersion.archived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUnarchiveVersion(selectedVersion.id)}
              >
                <ArchiveRestore className="h-4 w-4 mr-1" />
                Unarchive
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleArchiveVersion(selectedVersion.id)}
              >
                <Archive className="h-4 w-4 mr-1" />
                Archive
              </Button>
            ))}
        </div>
      )}

      {disconnectMessage && (
        <div className="rounded-lg border border-amber-500/50 p-3 mb-4 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          {disconnectMessage}
        </div>
      )}

      {multiplayerSession && (
        <div className="rounded-lg border p-4 bg-muted/30 mb-4 flex flex-wrap items-center gap-4">
          <span className="font-medium">Room: {multiplayerSession.code}</span>
          <span className="text-sm text-muted-foreground">
            Players: {multiplayerSession.players?.length ?? 0}/2
            {multiplayerSession.players?.map((p) => ` P${p.playerIndex + 1}${p.ready ? " ✓" : ""}`)}
          </span>
          {multiplayerSession.status === "waiting" && (
            <Button
              size="sm"
              onClick={() =>
                sessionReady({ variables: { sessionId: multiplayerSession.id } }).then(() => toast.success("Ready!")).catch(() => toast.error("Failed"))
              }
            >
              I&apos;m Ready
            </Button>
          )}
          {multiplayerSession.status === "waiting" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                leaveSession({
                  variables: { sessionId: multiplayerSession.id, playerIndex: localPlayerIndex },
                })
              }
            >
              Leave
            </Button>
          )}
        </div>
      )}

      {!multiplayerSession && game.status === "live" && displayedHostedAt && (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Button variant="outline" size="sm" onClick={() => setShowJoinInput(!showJoinInput)}>
            Join with code
          </Button>
          {showJoinInput && (
            <>
              <Input
                className="w-32"
                placeholder="Code"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                maxLength={6}
              />
              <Button size="sm" onClick={() => joinSession({ variables: { code: joinCodeInput.trim() } })}>
                Join
              </Button>
            </>
          )}
        </div>
      )}

      {game.status === "live" && displayedHostedAt ? (
        <div className="rounded-lg border overflow-hidden bg-muted/30 mb-8">
          <iframe
            ref={iframeRef}
            src={displayedHostedAt}
            title={game.title}
            className="w-full aspect-video min-h-[400px]"
          />
        </div>
      ) : (
        <div className="rounded-lg border p-8 bg-muted/30 mb-8 text-center text-muted-foreground">
          This game is not playable yet.
        </div>
      )}

      {game.description?.trim() ? (
        <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{game.description}</ReactMarkdown>
        </div>
      ) : null}

      <CommentSection flavor="game" contentId={gameId} />

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        flavor="game"
        contentId={gameId}
      />
      <RemoveDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove game"
        reason=""
        details=""
        onConfirm={handleRemove}
      />
    </div>
  );
}

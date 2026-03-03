"use client";

import { useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { gql, useQuery, useMutation } from "@apollo/client";
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
import { Fullscreen, GitBranch, Flag, Trash2, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

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

"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { gql, useQuery, useMutation } from "@apollo/client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/components/comment-section";
import { ReportDialog } from "@/components/report-dialog";
import { RemoveDialog } from "@/components/remove-dialog";
import { Fullscreen, GitBranch, Flag, Trash2 } from "lucide-react";
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

export default function GamePage() {
  const params = useParams();
  const gameId = parseInt(params.gameId as string, 10);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const { data, refetch } = useQuery(GAME_QUERY, {
    variables: { id: gameId },
    skip: isNaN(gameId),
  });
  const [forkGame] = useMutation(FORK_MUTATION);

  const game = data?.game;
  const me = data?.me;
  const isMod = me?.role === "janny" || me?.role === "admincel";

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
        <div className="flex gap-2">
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

      {game.status === "live" && game.hostedAt ? (
        <div className="rounded-lg border overflow-hidden bg-muted/30 mb-8">
          <iframe
            ref={iframeRef}
            src={game.hostedAt}
            title={game.title}
            className="w-full aspect-video min-h-[400px]"
          />
        </div>
      ) : (
        <div className="rounded-lg border p-8 bg-muted/30 mb-8 text-center text-muted-foreground">
          This game is not playable yet.
        </div>
      )}

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

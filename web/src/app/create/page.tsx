"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { gql, useQuery, useMutation, useSubscription } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ImagePlus, Send, Hammer } from "lucide-react";
import { toast } from "sonner";
import { getRecaptchaToken } from "@/lib/recaptcha-client";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { AnimatePresence, motion } from "framer-motion";
import { normalize, fade_out, transition_fast, fade_out_scale_1 } from "@/lib/transitions";
import Spinner from "@/components/ui/spinner";
import { formatPlanToDescription } from "@/lib/game-service-plan";

const CREATE_GAME_MUTATION = gql`
  mutation CreateGame($message: String!, $logoUrl: String, $recaptchaToken: String) {
    createGame(message: $message, logoUrl: $logoUrl, recaptchaToken: $recaptchaToken) {
      id
      title
      status
    }
  }
`;

const GAME_QUERY = gql`
  query GameForCreate($id: Int!) {
    game(id: $id) {
      id
      title
      status
      hostedAt
      logoUrl
      versions {
        id
        isDefault
        planSnapshot
      }
    }
  }
`;

const GAME_PLAN_QUERY = gql`
  query GamePlanForCreate($gameId: Int!) {
    gamePlan(gameId: $gameId) {
      id
      planText
      description
    }
  }
`;

const CHAT_MESSAGES_QUERY = gql`
  query ChatMessagesForCreate($gameId: Int!) {
    chatMessages(gameId: $gameId) {
      id
      role
      messageKind
      message
      createdAt
    }
  }
`;

const CHAT_MESSAGE_ADDED_SUBSCRIPTION = gql`
  subscription ChatMessageAdded($gameId: Int!) {
    chatMessageAdded(gameId: $gameId) {
      id
      role
      messageKind
      message
      createdAt
    }
  }
`;

const SEND_MESSAGE_MUTATION = gql`
  mutation SendChatMessage($gameId: Int!, $message: String!) {
    sendChatMessage(gameId: $gameId, message: $message) {
      id
      role
      messageKind
      message
      createdAt
    }
  }
`;

const UPDATE_GAME_LOGO_MUTATION = gql`
  mutation UpdateGameLogo($gameId: Int!, $logoUrl: String!) {
    updateGameLogo(gameId: $gameId, logoUrl: $logoUrl) {
      id
      logoUrl
    }
  }
`;

const UPDATE_PLAN_MUTATION = gql`
  mutation UpdateGamePlan($gameId: Int!, $planText: String!, $description: String) {
    updateGamePlan(gameId: $gameId, planText: $planText, description: $description) {
      id
      planText
      description
    }
  }
`;

const UPDATE_PLAN_FROM_DESCRIPTION_MUTATION = gql`
  mutation UpdateGamePlanFromDescription($gameId: Int!, $description: String!) {
    updateGamePlanFromDescription(gameId: $gameId, description: $description) {
      id
      planText
      description
    }
  }
`;

const BUILD_GAME_MUTATION = gql`
  mutation BuildGame($gameId: Int!) {
    buildGame(gameId: $gameId) {
      id
      status
    }
  }
`;

const BUILD_LOGS_SUBSCRIPTION = gql`
  subscription BuildLogs($gameId: Int!) {
    buildLogs(gameId: $gameId) {
      __typename
      id
      buildText
      createdAt
    }
  }
`;

const PLAN_CHUNKS_SUBSCRIPTION = gql`
  subscription PlanChunks($gameId: Int!) {
    planChunks(gameId: $gameId) {
      planText
    }
  }
`;

const GAME_BUILD_LOGS_QUERY = gql`
  query GameBuildLogs($gameId: Int!) {
    gameBuildLogs(gameId: $gameId) {
      __typename
      id
      buildText
      createdAt
    }
  }
`;

const INITIAL_AI_MESSAGE = "Describe the game you want to make.";

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("id");
  const gameId = gameIdParam ? parseInt(gameIdParam, 10) : null;

  const [message, setMessage] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [planText, setPlanText] = useState("");
  const [activeTab, setActiveTab] = useState("plan");
  const [buildLogLines, setBuildLogLines] = useState<string[]>([]);
  const [buildLogsFetchFallback, setBuildLogsFetchFallback] = useState<string[]>([]);
  const [buildLogsStream, setBuildLogsStream] = useState<string[]>([]);
  const [initialPlanReceived, setInitialPlanReceived] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [planViewMode, setPlanViewMode] = useState<"json" | "description">("json");
  const [descriptionText, setDescriptionText] = useState("");
  const [planGenerating, setPlanGenerating] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const lastPlanChunkTimeRef = useRef(0);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (planText && !initialPlanReceived) {
      setInitialPlanReceived(true);
    }
  }, [planText]);


  const { data: gameData, refetch: refetchGame } = useQuery(GAME_QUERY, {
    variables: { id: gameId! },
    skip: !gameId,
  });
  const { data: planData, refetch: refetchPlan } = useQuery(GAME_PLAN_QUERY, {
    variables: { gameId: gameId! },
    skip: !gameId,
  });
  const { data: buildLogsData, refetch: refetchBuildLogs } = useQuery(
    GAME_BUILD_LOGS_QUERY,
    {
      variables: { gameId: gameId! },
      skip: !gameId,
      fetchPolicy: "no-cache",
    },
  );
  const { data: messagesData, refetch: refetchMessages } = useQuery(
    CHAT_MESSAGES_QUERY,
    { variables: { gameId: gameId! }, skip: !gameId }
  );

  useSubscription(BUILD_LOGS_SUBSCRIPTION, {
    variables: { gameId: gameId! },
    skip: !gameId,
    onData: ({ data }) => {
      const text = data?.data?.buildLogs?.buildText ?? (data as { buildLogs?: { buildText?: string } })?.buildLogs?.buildText;
      if (text != null) {
        setBuildLogLines((prev) => [...prev, text]);
        refetchBuildLogs();
      }
    },
    onError: () => {
      // Socket often closes with 1006 after redirect; build logs are shown via polling
    },
  });

  useSubscription(PLAN_CHUNKS_SUBSCRIPTION, {
    variables: { gameId: gameId! },
    skip: !gameId,
    onData: ({ data }) => {
      const chunk =
        data?.data?.planChunks?.planText ??
        (data as { planChunks?: { planText?: string } })?.planChunks?.planText;
      if (chunk != null) {
        lastPlanChunkTimeRef.current = Date.now();
        setPlanGenerating(true);
        setPlanText((prev) => prev + chunk);
      }
    },
  });

  const [createGame, { loading: creating }] = useMutation(CREATE_GAME_MUTATION);
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE_MUTATION);
  const [updatePlan] = useMutation(UPDATE_PLAN_MUTATION);
  const [updatePlanFromDescription, { loading: savingFromDescription }] =
    useMutation(UPDATE_PLAN_FROM_DESCRIPTION_MUTATION);
  const [updateGameLogo] = useMutation(UPDATE_GAME_LOGO_MUTATION);
  const [buildGame, { loading: building }] = useMutation(BUILD_GAME_MUTATION);
  const [logoUploading, setLogoUploading] = useState(false);

  const game = gameData?.game;
  const gamePlan = planData?.gamePlan;
  const messages = (messagesData?.chatMessages ?? []) as {
    id: number;
    role: string;
    messageKind: string | null;
    message: string;
    createdAt: string;
  }[];
  const chatDisplayMessages = messages.filter(
    (msg) =>
      (msg.role || "user") === "user" ||
      msg.messageKind === "clarification"
  );
  const isPlanning = game?.status === "planning";
  const isBuilding = game?.status === "building";
  const isLive = game?.status === "live";

  // Disabled while building, or while in planning and either waiting for first plan or still generating.
  // Never clear planGenerating on a timer — only when we know the plan is complete (gamePlan.planText sync or assistant message).
  const planOrBuildInProgress =
    isBuilding || (isPlanning && !initialPlanReceived) || planGenerating;

  useEffect(() => {
    setPlanViewMode(planOrBuildInProgress ? "json" : "description");
    if (!planOrBuildInProgress) setDescriptionText(
      gamePlan?.description?.trim() ?? formatPlanToDescription(planText),
    );
  }, [planOrBuildInProgress, setPlanViewMode]);

  // Treat "planning" with no content yet as generating so textareas stay disabled
  useEffect(() => {
    if (gameId && isPlanning && !planText.trim()) {
      setPlanGenerating(true);
    }
  }, [gameId, isPlanning, planText]);

  const hasPrefilledFromVersion = useRef(false);
  useEffect(() => {
    if (!gamePlan?.planText) return;
    try {
      const parsed = JSON.parse(gamePlan.planText);
      setPlanText(JSON.stringify(parsed, null, 2));
    } catch {
      setPlanText(gamePlan.planText);
    }
    setPlanGenerating(false);
  }, [gamePlan?.planText]);

  useEffect(() => {
    if (gameId && game?.logoUrl) {
      setLogoUrl(game.logoUrl);
    }
  }, [gameId, game?.logoUrl]);

  useEffect(() => {
    if (!gameId || !gameData?.game?.versions?.length || hasPrefilledFromVersion.current) return;
    const versions = gameData.game.versions as { isDefault: boolean; planSnapshot: string }[];
    const defaultVer = versions.find((v) => v.isDefault) ?? versions[0];
    if (!defaultVer?.planSnapshot) return;
    const serverPlan = planData?.gamePlan?.planText?.trim() ?? "";
    if (serverPlan) return;
    hasPrefilledFromVersion.current = true;
    try {
      setPlanText(JSON.stringify(JSON.parse(defaultVer.planSnapshot), null, 2));
    } catch {
      setPlanText(defaultVer.planSnapshot);
    }
    setInitialPlanReceived(true);
  }, [gameId, gameData?.game?.versions, planData?.gamePlan?.planText]);


  // Poll build logs whenever user is on Build tab (subscription often closes with 1006, so we rely on polling)
  useEffect(() => {
    if (!gameId || activeTab !== "build") return;
    refetchBuildLogs();

    const queryPayload = {
      query:
        "query GameBuildLogs($gameId: Int!) { gameBuildLogs(gameId: $gameId) { id buildText createdAt } }",
      variables: { gameId },
      operationName: "GameBuildLogs",
    };

    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(queryPayload),
        });
        const json = await res.json();
        const list = json?.data?.gameBuildLogs;
        if (Array.isArray(list)) {
          const lines = list.map((l: { buildText: string }) => l.buildText);
          setBuildLogsFetchFallback(lines);
        }
      } catch (e) {
        console.warn("[client] buildLogs fetch fallback error:", e);
      }
    };

    const fetchBuildLogStream = async () => {
      try {
        const res = await fetch(
          `/api/build-log-stream?gameId=${encodeURIComponent(gameId)}`,
        );
        const json = (await res.json()) as { logs?: string[] };
        const logs = Array.isArray(json?.logs) ? json.logs : [];
        if (logs.length > 0) {
          setBuildLogsStream(logs);
        }
      } catch {
        // ignore
      }
    };

    fetchLogs();
    fetchBuildLogStream();
    refetchGame();
    const t = setInterval(() => {
      refetchBuildLogs();
      refetchGame();
      fetchLogs();
      fetchBuildLogStream();
    }, 1000);
    return () => clearInterval(t);
  }, [gameId, activeTab, refetchBuildLogs, refetchGame]);

  const fromQuery =
    buildLogsData?.gameBuildLogs?.length
      ? buildLogsData.gameBuildLogs.map((l: { buildText: string }) => l.buildText)
      : null;
  const fromFallback = buildLogsFetchFallback.length > 0 ? buildLogsFetchFallback : null;
  const fromStream = buildLogsStream.length > 0 ? buildLogsStream : null;
  const displayBuildLogs = fromQuery ?? fromFallback ?? fromStream ?? buildLogLines;

  // Refetch plan and messages periodically after landing with gameId so we pick up the
  // first response if the subscription event was missed (e.g. WebSocket not ready after redirect)
  useEffect(() => {
    if (!gameId || !isPlanning) return;
    const intervalMs = 3000;
    const maxAttempts = 100;
    let attempts = 0;
    const t = setInterval(() => {
      attempts += 1;
      refetchPlan();
      refetchMessages();
      if (attempts >= maxAttempts) clearInterval(t);
    }, intervalMs);
    return () => clearInterval(t);
  }, [gameId, isPlanning, refetchPlan, refetchMessages]);

  // Poll plan stream so we show plan text even when subscription doesn't deliver (e.g. WS 1006)
  useEffect(() => {
    if (!gameId || !isPlanning) return;
    let t: NodeJS.Timeout;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/plan-stream?gameId=${encodeURIComponent(gameId)}`,
        );
        const json = (await res.json()) as { planText?: string };
        const next =
          typeof json?.planText === "string" ? json.planText : "";
        if (next.length > 0) {
          setPlanText((prev) =>
            next.length > prev.length ? next : prev,
          );
        }
      } catch {
        // ignore
      }
    };
    poll();
    t = setInterval(poll, 1500);
    return () => clearInterval(t);
  }, [gameId, isPlanning]);

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;

    if (!gameId) {
      try {
        const recaptchaToken = await getRecaptchaToken("create_game");
        const { data } = await createGame({
          variables: {
            message: text,
            logoUrl: logoUrl || undefined,
            recaptchaToken: recaptchaToken ?? undefined,
          },
        });
        const id = data?.createGame?.id;
        if (id) {
          router.push(`/create?id=${id}`);
          setMessage("");
        } else {
          console.log(data)
          toast.error("Failed to create game.");
        }
      } catch (err) {
        console.error("Failed to create game:", err);
        toast.error("Failed to create game.");
      }
      return;
    }

    try {
      setPlanText("");
      setInitialPlanReceived(false);
      setPlanGenerating(true);
      await sendMessage({ variables: { gameId, message: text } });
      setMessage("");
      refetchMessages();
    } catch {
      setPlanGenerating(false);
      toast.error("Failed to send message.");
    }
  };

  const handleSavePlan = () => {
    if (!gameId) return;
    if (planViewMode === "json") {
      if (!planText.trim()) return;
      updatePlan({ variables: { gameId, planText } })
        .then(() => {
          toast.success("Plan saved.");
          refetchPlan();
        })
        .catch(() => toast.error("Failed to save plan."));
    } else {
      if (!descriptionText.trim()) return;
      updatePlanFromDescription({
        variables: { gameId, description: descriptionText },
      })
        .then((result) => {
          toast.success("Plan saved.");
          refetchPlan();
          const updated = result.data?.updateGamePlanFromDescription;
          if (updated) {
            try {
              setPlanText(JSON.stringify(JSON.parse(updated.planText), null, 2));
            } catch {
              setPlanText(updated.planText);
            }
            if (updated.description != null) setDescriptionText(updated.description);
          }
        })
        .catch((err) => {
          toast.error(err?.message ?? "Failed to save plan.");
        });
    }
  };

  const handlePreview = async () => {
    if (previewHtml) return setPreviewHtml(null);
    if (!planText.trim()) {
      toast.error("No plan to preview.");
      return;
    }
    setPreviewError(null);
    setPreviewHtml(null);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Preview failed: ${res.status}`);
      }
      const html = await res.text();
      setPreviewHtml(html);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      toast.error("Preview failed.");
    }
  };

  const handleBuild = () => {
    if (!gameId) return;
    buildGame({ variables: { gameId } })
      .then(() => {
        setActiveTab("build");
        refetchGame();
        refetchBuildLogs();
      })
      .catch(() => toast.error("Failed to start build."));
  };

  useSubscription(CHAT_MESSAGE_ADDED_SUBSCRIPTION, {
    variables: { gameId: gameId! },
    skip: !gameId,
    onData: () => {
      refetchMessages();
      refetchPlan().then(() => {
        setPlanGenerating(false);
      });
    },
  });

  const hasRedirectedOnBuild = useRef(false);
  useEffect(() => {
    if (gameId && isLive && activeTab === "build" && !hasRedirectedOnBuild.current) {
      hasRedirectedOnBuild.current = true;
      router.push(`/games/${gameId}`);
    }
  }, [gameId, isLive, activeTab, router]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatDisplayMessages]);

  const buildTabDisabled = isPlanning;

  const chatSection = (
    <>
      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 flex flex-col scroll-smooth"
      >
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
            <p className="text-sm text-muted-foreground">{INITIAL_AI_MESSAGE}</p>
          </div>
        </div>
        {chatDisplayMessages.map((msg) => {
          const isUser = (msg.role || "user") === "user";
          return (
            <motion.div
              key={msg.id}
              initial={fade_out}
              animate={normalize}
              exit={fade_out_scale_1}
              transition={transition_fast}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isUser
                  ? "rounded-tr-md bg-primary text-primary-foreground"
                  : "rounded-tl-md bg-muted"
                  }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
      <div className="p-4 border-t">
        <Textarea
          placeholder={
            gameId ? "Refine the plan or add details..." : "Describe your game..."
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          disabled={creating || sending}
          className="flex-1 min-w-0"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={logoUploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setLogoUploading(true);
                try {
                  const form = new FormData();
                  form.append("file", f);
                  if (gameId != null) form.append("gameId", String(gameId));
                  const res = await fetch("/api/upload-logo", {
                    method: "POST",
                    body: form,
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    toast.error(data?.error ?? "Logo upload failed.");
                    return;
                  }
                  const url = data?.url;
                  if (url) {
                    setLogoUrl(url);
                    if (gameId != null) {
                      await updateGameLogo({
                        variables: { gameId, logoUrl: url },
                      });
                      refetchGame();
                    }
                  }
                } catch (err) {
                  console.error(err);
                  toast.error("Logo upload failed.");
                } finally {
                  setLogoUploading(false);
                  e.target.value = "";
                }
              }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={logoUploading}
                  aria-label={logoUrl ? "Change logo" : "Select a logo"}
                  onClick={() => logoFileInputRef.current?.click()}
                  className={logoUrl ? "p-0" : undefined}
                >
                  {logoUploading ? (
                    <Spinner size="sm" />
                  ) : logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="w-full h-full object-cover rounded-md"
                    />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{logoUrl ? "Change logo" : "Select a logo"}</p>
              </TooltipContent>
            </Tooltip>
            {gameId && !isLive && !isBuilding && (
              <Button onClick={handleBuild} variant="secondary" disabled={building || !initialPlanReceived}>
                {building ? <Spinner size="sm" /> : "Build"}
              </Button>
            )}
          </div>


          <Button
            onClick={handleSend}
            disabled={
              creating || sending || !message.trim() || (!!gameId && isBuilding)
            }
          >
            {creating ? <Spinner size="sm" /> : sending ? <Spinner size="sm" /> : "Send"}
          </Button>

        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)]">
      <div
        className={`overflow-hidden transition-all duration-300 flex flex-col ${gameId ? "min-h-0 flex-1 md:max-w-[66.666%] md:w-2/3 md:border-r" : "h-0 md:h-auto md:w-0"}`}

      >
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="shrink-0 mx-4 mt-4">
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="build" disabled={buildTabDisabled}>
              Build
            </TabsTrigger>
          </TabsList>


          <AnimatePresence mode="wait">
            {activeTab === "plan" && (
              <motion.div key="plan" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="flex-1 m-4 mt-2 min-h-0">
                <AnimatePresence mode="wait">
                  {initialPlanReceived ? (
                    <motion.div
                      className={`h-full min-h-[200px] resize-none flex flex-col ${planOrBuildInProgress ? "pointer-events-none opacity-90" : ""}`}
                      key="received"
                      initial={fade_out}
                      animate={normalize}
                      exit={fade_out_scale_1}
                      transition={transition_fast}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex gap-2 mb-2 pointer-events-auto">
                          <Button
                            type="button"
                            variant={planViewMode === "description" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => {
                              setPlanViewMode("description");
                              setDescriptionText(
                                gamePlan?.description?.trim() ?? formatPlanToDescription(planText),
                              );
                            }}
                            disabled={planOrBuildInProgress}
                          >
                            Description
                          </Button>
                          <Button
                            type="button"
                            variant={planViewMode === "json" ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setPlanViewMode("json")}
                            disabled={planOrBuildInProgress}
                          >
                            JSON
                          </Button>
                        </div>
                        {planOrBuildInProgress && <Spinner size="sm" />}
                      </div>

                      {planViewMode === "json" ? (
                        <Textarea
                          className="flex-1 min-h-0"
                          placeholder="Build plan will appear here..."
                          value={planText}
                          onChange={(e) => setPlanText(e.target.value)}
                          disabled={planOrBuildInProgress}
                          readOnly={planOrBuildInProgress}
                        />
                      ) : (
                        <Textarea
                          className="flex-1 min-h-0 font-sans"
                          placeholder="Title, description, rules, and controls..."
                          value={descriptionText}
                          onChange={(e) => setDescriptionText(e.target.value)}
                          disabled={planOrBuildInProgress}
                          readOnly={planOrBuildInProgress}
                        />
                      )}
                      <div className="py-2 flex flex-wrap gap-2 pointer-events-auto">
                        <Button
                          onClick={handleSavePlan}
                          disabled={planOrBuildInProgress || savingFromDescription || (planViewMode === "json" ? !planText.trim() : !descriptionText.trim())}
                        >
                          {savingFromDescription ? <Spinner size="sm" /> : "Save plan"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handlePreview}
                          disabled={planOrBuildInProgress || !planText.trim()}
                        >
                          Preview
                        </Button>
                      </div>
                      {previewError && (
                        <p className="mt-2 text-sm text-destructive">{previewError}</p>
                      )}
                      {/* className={`overflow-hidden transition-all duration-300 flex flex-col ${gameId ? "min-h-0 flex-1 md:max-w-[66.666%] md:w-2/3 md:border-r" : "h-0 md:h-auto md:w-0"}`} */}
                      <div className={`${previewHtml ? "h-[300px] border" : "h-0"} transition-all duration-300 rounded  overflow-hidden ${planOrBuildInProgress ? "opacity-50" : ""}`}>
                        <iframe
                          title="Game preview"
                          srcDoc={previewHtml ?? undefined}
                          className="w-full h-full border-0"
                          sandbox="allow-scripts"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div key="not-received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full flex flex-col items-center justify-center">
                      <Spinner className="mx-auto" />
                    </motion.div>

                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {activeTab === "build" && (
              <motion.div key="build" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="flex-1 m-4 mt-2 min-h-0 overflow-auto">
                <AnimatePresence mode="wait">
                  {displayBuildLogs.length > 0 ? (
                    <motion.div key="received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full">
                      <Card className="p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {displayBuildLogs.map((log: string) => (
                            <motion.div
                              initial={{
                                ...fade_out,
                                width: 0
                              }}
                              animate={{
                                ...normalize,
                                width: "auto"
                              }}
                              exit={fade_out_scale_1}
                              transition={transition_fast}
                              key={log}
                            >
                              {log}
                            </motion.div>
                          ))}
                        </pre>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="not-received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full flex flex-col items-center justify-center">
                      <h5 className="text-sm mb-4">Building Game. This may take a few minutes.</h5>
                      <Spinner className="mx-auto" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>


        </Tabs>
      </div>
      <div
        className={`transition-all duration-300 flex flex-col border-t md:border-t-0 md:border-l min-h-[50vh] md:min-h-0 ${gameId ? "md:w-1/3 md:min-w-[280px]" : "flex-1 w-full"
          }`}
      >
        {chatSection}
      </div>
    </div>
  );
}

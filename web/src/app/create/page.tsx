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
    }
  }
`;

const GAME_PLAN_QUERY = gql`
  query GamePlanForCreate($gameId: Int!) {
    gamePlan(gameId: $gameId) {
      id
      planText
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

const UPDATE_PLAN_MUTATION = gql`
  mutation UpdateGamePlan($gameId: Int!, $planText: String!) {
    updateGamePlan(gameId: $gameId, planText: $planText) {
      id
      planText
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
  const [initialPlanReceived, setInitialPlanReceived] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
  const { data: messagesData, refetch: refetchMessages } = useQuery(
    CHAT_MESSAGES_QUERY,
    { variables: { gameId: gameId! }, skip: !gameId }
  );

  useSubscription(BUILD_LOGS_SUBSCRIPTION, {
    variables: { gameId: gameId! },
    skip: !gameId,
    onData: ({ data }) => {
      const text = data?.data?.buildLogs?.buildText;
      if (text) setBuildLogLines((prev) => [...prev, text]);
    },
  });

  const [createGame, { loading: creating }] = useMutation(CREATE_GAME_MUTATION);
  const [sendMessage, { loading: sending }] = useMutation(SEND_MESSAGE_MUTATION);
  const [updatePlan] = useMutation(UPDATE_PLAN_MUTATION);
  const [buildGame, { loading: building }] = useMutation(BUILD_GAME_MUTATION);

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

  useEffect(() => {
    if (gamePlan?.planText) setPlanText(gamePlan.planText);
  }, [gamePlan?.planText]);

  // Refetch plan and messages periodically after landing with gameId so we pick up the
  // first response if the subscription event was missed (e.g. WebSocket not ready after redirect)
  useEffect(() => {
    if (!gameId || !isPlanning) return;
    const intervalMs = 3000;
    const maxAttempts = 10;
    let attempts = 0;
    const t = setInterval(() => {
      attempts += 1;
      refetchPlan();
      refetchMessages();
      if (attempts >= maxAttempts) clearInterval(t);
    }, intervalMs);
    return () => clearInterval(t);
  }, [gameId, isPlanning, refetchPlan, refetchMessages]);

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
      await sendMessage({ variables: { gameId, message: text } });
      setMessage("");
      refetchMessages();
    } catch {
      toast.error("Failed to send message.");
    }
  };

  const handleSavePlan = () => {
    if (!gameId || !planText.trim()) return;
    updatePlan({ variables: { gameId, planText } })
      .then(() => toast.success("Plan saved."))
      .catch(() => toast.error("Failed to save plan."));
  };

  const handleBuild = () => {
    if (!gameId) return;
    buildGame({ variables: { gameId } })
      .then(() => {
        setActiveTab("build");
        refetchGame();
      })
      .catch(() => toast.error("Failed to start build."));
  };

  useSubscription(CHAT_MESSAGE_ADDED_SUBSCRIPTION, {
    variables: { gameId: gameId! },
    skip: !gameId,
    onData: () => {
      refetchMessages();
      refetchPlan();
    },
  });

  useEffect(() => {
    if (isLive && activeTab === "build") setActiveTab("play");
  }, [isLive, activeTab]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chatDisplayMessages]);

  const buildTabDisabled = isPlanning;
  const playDisabled = !isLive;

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
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setLogoUrl(URL.createObjectURL(f));
                }}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" variant="outline" size="icon">
                    <ImagePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Select a logo</p>
                </TooltipContent>
              </Tooltip>
            </label>
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
        className={`overflow-hidden transition-all duration-500 flex flex-col ${gameId ? "min-h-0 flex-1 md:max-w-[66.666%] md:w-2/3 md:border-r" : "h-0 md:h-auto md:w-0"}`}

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
            <TabsTrigger value="play" disabled={playDisabled}>
              Play
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            {activeTab === "plan" && (
              <motion.div key="plan" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="flex-1 m-4 mt-2 min-h-0">
                <AnimatePresence mode="wait">
                  {initialPlanReceived ? (
                    <motion.div key="received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full">
                      <Textarea
                        className="h-full min-h-[200px] resize-none"
                        placeholder="Build plan will appear here..."
                        value={planText}
                        onChange={(e) => setPlanText(e.target.value)}
                        disabled={isBuilding}
                      />
                      <Button
                        className="mt-2"
                        onClick={handleSavePlan}
                        disabled={isBuilding}
                      >
                        Save plan
                      </Button>
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
                  {buildLogLines.length > 0 ? (
                    <motion.div key="received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full">
                      <Card className="p-4">
                        <pre className="text-sm whitespace-pre-wrap font-mono">
                          {buildLogLines.length > 0
                            ? buildLogLines.join("\n")
                            : building
                              ? "Build in progress..."
                              : "Build logs will stream here when you run Build."}
                        </pre>
                      </Card>
                    </motion.div>
                  ) : (
                    <motion.div key="not-received" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="h-full flex flex-col items-center justify-center">
                      <Spinner className="mx-auto" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
            {activeTab === "play" && (
              <motion.div key="play" initial={fade_out} animate={normalize} exit={fade_out_scale_1} transition={transition_fast} className="flex-1 m-4 mt-2 min-h-0">
                {game?.hostedAt ? (
                  <iframe
                    src={game.hostedAt}
                    title="Game"
                    className="w-full h-full min-h-[300px] rounded border bg-background"
                  />
                ) : (
                  <p className="text-muted-foreground">Game not ready to play yet.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>


        </Tabs>
      </div>
      <div
        className={`transition-all duration-500 flex flex-col border-t md:border-t-0 md:border-l min-h-[50vh] md:min-h-0 ${gameId ? "md:w-1/3 md:min-w-[280px]" : "flex-1 w-full"
          }`}
      >
        {chatSection}
      </div>
    </div>
  );
}

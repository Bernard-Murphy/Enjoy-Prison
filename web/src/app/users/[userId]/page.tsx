"use client";

import { useParams } from "next/navigation";
import { gql, useQuery } from "@apollo/client";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CommentSection } from "@/components/comment-section";
import { GameCard } from "@/components/game-card";
import { ReportDialog } from "@/components/report-dialog";
import { Flag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { ME_QUERY } from "@/lib/graphql/queries";

const USER_QUERY = gql`
  query UserPage($id: Int!) {
    user(id: $id) {
      id
      username
      displayName
      avatar
      bio
      role
    }
    me {
      id
      role
    }
  }
`;

const USER_GAMES_QUERY = gql`
  query UserGames($id: Int!) {
    user(id: $id) {
      id
      games {
        id
        title
        description
        views
      }
    }
  }
`;

export default function UserPage() {
  const params = useParams();
  const userId = parseInt(params.userId as string, 10);
  const [reportOpen, setReportOpen] = useState(false);

  const { data } = useQuery(USER_QUERY, {
    variables: { id: userId },
    skip: isNaN(userId),
  });
  const { data: gamesData } = useQuery(USER_GAMES_QUERY, {
    variables: { id: userId },
    skip: isNaN(userId),
  });

  const user = data?.user;
  const me = data?.me;
  const isOwnProfile = me?.id === userId;
  const isMod = me?.role === "janny" || me?.role === "admincel";
  const games = gamesData?.user?.games ?? [];

  if (isNaN(userId) || (!user && data !== undefined)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-6 items-start">
        <Avatar className="h-24 w-24">
          {user.avatar && <AvatarImage src={user.avatar} alt={user.username} />}
          <AvatarFallback className="text-2xl">
            {user.username[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user.displayName || user.username}</h1>
          <p className="text-muted-foreground">@{user.username}</p>
          {user.bio && (
            <div className="prose prose-sm dark:prose-invert max-w-none mt-2">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{user.bio}</ReactMarkdown>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            {isOwnProfile && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/users/${userId}/edit`}>Edit profile</Link>
              </Button>
            )}
            {!isOwnProfile && !isMod && (
              <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4 mr-1" />
                Report
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="games" className="mt-8">
        <TabsList>
          <TabsTrigger value="games">Games</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
        </TabsList>
        <TabsContent value="games" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game: { id: number; title: string; description: string; views: number }) => (
              <GameCard
                key={game.id}
                id={game.id}
                title={game.title}
                description={game.description}
                views={game.views}
              />
            ))}
          </div>
          {games.length === 0 && (
            <p className="text-muted-foreground py-8">No games yet.</p>
          )}
        </TabsContent>
        <TabsContent value="messages" className="mt-4">
          <CommentSection flavor="user" contentId={userId} />
        </TabsContent>
      </Tabs>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        flavor="user"
        contentId={userId}
      />
    </div>
  );
}

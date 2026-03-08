"use client";

import Link from "next/link";
import { gql, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { GameCard } from "@/components/game-card";

const POPULAR_GAMES_QUERY = gql`
  query PopularGames($limit: Int) {
    popularGames(limit: $limit) {
      id
      title
      description
      views
      logoUrl
    }
  }
`;

const RECENT_GAMES_QUERY = gql`
  query RecentGames($limit: Int) {
    recentGames(limit: $limit) {
      id
      title
      description
      views
      logoUrl
    }
  }
`;

export default function HomePage() {
  const { data: popularData } = useQuery(POPULAR_GAMES_QUERY, {
    variables: { limit: 12 },
  });
  const { data: recentData } = useQuery(RECENT_GAMES_QUERY, {
    variables: { limit: 12 },
  });

  const popularGames = popularData?.popularGames ?? [];
  const recentGames = recentData?.recentGames ?? [];

  return (
    <div className="min-h-screen">
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          EP Games
        </h1>
        <p className="mt-4 mb-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Create your own games in seconds with AI. Describe what you want, and
          we&apos;ll build it.
        </p>
        <Button bouncyClasses="w-max-content mx-auto" asChild size="lg">
          <Link href="/create">
            Create your own game for free in seconds
          </Link>
        </Button>
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Popular Games</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {popularGames.map((game: { id: number; title: string; description: string; views: number; logoUrl?: string | null }) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              description={game.description}
              views={game.views}
              thumbnailUrl={game.logoUrl ?? undefined}
            />
          ))}
        </div>
        {popularGames.length === 0 && (
          <p className="text-muted-foreground">No games yet. Be the first to create one!</p>
        )}
      </section>

      <section className="container mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Recently Created</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {recentGames.map((game: { id: number; title: string; description: string; views: number; logoUrl?: string | null }) => (
            <GameCard
              key={game.id}
              id={game.id}
              title={game.title}
              description={game.description}
              views={game.views}
              thumbnailUrl={game.logoUrl ?? undefined}
            />
          ))}
        </div>
        {recentGames.length === 0 && (
          <p className="text-muted-foreground">No games yet.</p>
        )}
      </section>
    </div>
  );
}

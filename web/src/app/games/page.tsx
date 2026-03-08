"use client";

import { useState } from "react";
import { gql, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GameCard } from "@/components/game-card";
import { ChevronDown, Search } from "lucide-react";

const GAMES_QUERY = gql`
  query Games($offset: Int, $limit: Int, $sort: String, $search: String) {
    games(offset: $offset, limit: $limit, sort: $sort, search: $search) {
      id
      title
      description
      views
      logoUrl
    }
  }
`;

const SEARCH_GAMES_QUERY = gql`
  query SearchGames($query: String!, $filters: SearchFilters) {
    searchGames(query: $query, filters: $filters) {
      games {
        id
        title
        description
        views
        logoUrl
      }
      total
    }
  }
`;

const PAGE_SIZE = 12;

export default function BrowsePage() {
  const [query, setQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState<"popular" | "newest">("newest");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [offset, setOffset] = useState(0);

  const useSearch = query.trim().length > 0;

  const { data: listData } = useQuery(GAMES_QUERY, {
    variables: {
      offset,
      limit: PAGE_SIZE,
      sort: sort === "popular" ? "popular" : "newest",
    },
    skip: useSearch,
  });

  const { data: searchData } = useQuery(SEARCH_GAMES_QUERY, {
    variables: {
      query: query.trim(),
      filters: { sort: sort === "popular" ? "popular" : "newest" },
    },
    skip: !useSearch,
  });

  const games = useSearch
    ? searchData?.searchGames?.games ?? []
    : listData?.games ?? [];
  const total = useSearch ? searchData?.searchGames?.total ?? 0 : 0;

  const handleSearch = () => {
    setQuery(searchInput);
    setOffset(0);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Browse Games</h1>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 flex gap-2">
          <Input
            placeholder="Search games..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button onClick={handleSearch} size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div>
          <Button
            variant="outline"
            onClick={() => setAdvancedOpen((o) => !o)}
          >
            Advanced options <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
          </Button>
          {advancedOpen && (
            <div className="mt-4 p-4 border rounded-lg bg-muted/30">
              <label className="block text-sm font-medium mb-2">Sort by</label>
              <div className="flex gap-2">
                <Button
                  variant={sort === "newest" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSort("newest")}
                >
                  Newest
                </Button>
                <Button
                  variant={sort === "popular" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSort("popular")}
                >
                  Popular
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {games.map((game: { id: number; title: string; description: string; views: number; logoUrl?: string | null }) => (
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

      {games.length === 0 && (
        <p className="text-muted-foreground py-8">No games found.</p>
      )}

      {!useSearch && listData?.games?.length === PAGE_SIZE && (
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setOffset((o) => o + PAGE_SIZE)}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

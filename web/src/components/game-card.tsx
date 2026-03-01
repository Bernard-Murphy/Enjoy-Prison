"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MAX_DESCRIPTION_LENGTH = 200;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "...";
}

export interface GameCardProps {
  id: number;
  title: string;
  description: string;
  views: number;
  thumbnailUrl?: string | null;
}

export function GameCard({
  id,
  title,
  description,
  views,
  thumbnailUrl,
}: GameCardProps) {
  const displayDescription = truncate(description || "", MAX_DESCRIPTION_LENGTH);

  return (
    <Link href={`/games/${id}`}>
      <Card className="overflow-hidden transition-colors hover:bg-accent/50">
        <div className="aspect-video w-full bg-muted relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              No thumbnail
            </div>
          )}
        </div>
        <CardHeader className="p-4">
          <CardTitle className="line-clamp-1 text-lg">{title}</CardTitle>
          <CardDescription className="line-clamp-3 text-sm">
            {displayDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
          {views} view{views !== 1 ? "s" : ""}
        </CardContent>
      </Card>
    </Link>
  );
}

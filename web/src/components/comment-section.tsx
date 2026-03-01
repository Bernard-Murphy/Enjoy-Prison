"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { gql, useQuery, useMutation } from "@apollo/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MessageSquare, Reply } from "lucide-react";
import { AuthDialog } from "@/components/auth-dialog";
import { ME_QUERY } from "@/lib/graphql/queries";
import { toast } from "sonner";

const commentSchema = z.object({
  text: z.string().min(1, "Comment cannot be empty").max(10000),
});

type CommentFormData = z.infer<typeof commentSchema>;

const COMMENTS_QUERY = gql`
  query Comments($flavor: String!, $contentId: Int!) {
    comments(flavor: $flavor, contentId: $contentId) {
      id
      text
      flavor
      replyingTo
      contentId
      userId
      createdAt
      user {
        id
        username
        displayName
        avatar
      }
    }
  }
`;

const CREATE_COMMENT_MUTATION = gql`
  mutation CreateComment($flavor: String!, $contentId: Int!, $text: String!, $repliesTo: Int) {
    createComment(flavor: $flavor, contentId: $contentId, text: $text, repliesTo: $repliesTo) {
      id
      text
      createdAt
    }
  }
`;

interface Comment {
  id: number;
  text: string;
  flavor: string;
  replyingTo: number | null;
  contentId: number;
  userId: number | null;
  createdAt: string;
  user: { id: number; username: string; displayName?: string; avatar?: string } | null;
}

interface CommentSectionProps {
  flavor: "user" | "game";
  contentId: number;
}

function formatDate(s: string) {
  try {
    return new Date(s).toLocaleDateString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return s;
  }
}

export function CommentSection({ flavor, contentId }: CommentSectionProps) {
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [repliesDialogOpen, setRepliesDialogOpen] = useState(false);
  const [selectedReplies, setSelectedReplies] = useState<Comment[]>([]);

  const form = useForm<CommentFormData>({
    resolver: zodResolver(commentSchema),
    defaultValues: { text: "" },
  });

  const { data: meData, refetch: refetchMe } = useQuery(ME_QUERY);
  const { data, loading, refetch } = useQuery(COMMENTS_QUERY, {
    variables: { flavor, contentId },
  });
  const [createComment, { loading: creating }] = useMutation(CREATE_COMMENT_MUTATION);

  const comments: Comment[] = data?.comments ?? [];
  const topLevel = comments.filter((c) => !c.replyingTo);
  const sorted = [...topLevel].sort((a, b) => {
    if (sort === "newest")
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return 0;
  });

  const handleSubmit = async (payload: CommentFormData) => {
    try {
      await createComment({
        variables: {
          flavor,
          contentId,
          text: payload.text,
          repliesTo: replyTo ?? undefined,
        },
      });
      form.reset();
      setReplyTo(null);
      refetch();
      toast.success("Comment posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    }
  };

  const showReplies = (comment: Comment) => {
    setSelectedReplies(comments.filter((c) => c.replyingTo === comment.id));
    setRepliesDialogOpen(true);
  };

  const replyCount = (c: Comment) => comments.filter((x) => x.replyingTo === c.id).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Comments ({comments.length})</h2>
        <div className="flex gap-2">
          <Button
            variant={sort === "newest" ? "default" : "outline"}
            size="sm"
            onClick={() => setSort("newest")}
          >
            Newest
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {replyTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Reply className="h-4 w-4" />
              Replying to #{replyTo}
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
                Cancel
              </Button>
            </div>
          )}
          <Textarea
            {...form.register("text")}
            placeholder="Write a comment (Markdown supported)..."
            disabled={creating}
          />
          {form.formState.errors.text && (
            <p className="text-sm text-destructive">{form.formState.errors.text.message}</p>
          )}
          <div className="flex justify-end gap-2">
            {!meData?.me && (
              <AuthDialog onSuccess={() => refetchMe()}>
                <Button type="button" variant="outline" size="sm">
                  Login to comment
                </Button>
              </AuthDialog>
            )}
            <Button type="submit" disabled={creating || !form.watch("text")?.trim()}>
              Post
            </Button>
          </div>
        </form>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading comments...</p>
      ) : (
        <div className="space-y-4">
          {sorted.map((comment) => (
            <Card key={comment.id} className="p-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {comment.user?.username ?? "Anonymous"}
                    </span>
                    <span>{formatDate(comment.createdAt)}</span>
                    <span>#{comment.id}</span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.text}</ReactMarkdown>
                  </div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyTo(comment.id)}
                    >
                      <Reply className="h-4 w-4 mr-1" />
                      Reply
                    </Button>
                    {replyCount(comment) > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => showReplies(comment)}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        {replyCount(comment)} replies
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={repliesDialogOpen} onOpenChange={setRepliesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replies</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {selectedReplies.map((reply) => (
              <Card key={reply.id} className="p-3">
                <div className="text-sm text-muted-foreground">
                  {reply.user?.username ?? "Anonymous"} · {formatDate(reply.createdAt)}
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none mt-1">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reply.text}</ReactMarkdown>
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

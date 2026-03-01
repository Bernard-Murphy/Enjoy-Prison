"use client";

import { useState } from "react";
import { gql, useMutation } from "@apollo/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CREATE_REPORT_MUTATION = gql`
  mutation CreateReport($flavor: String!, $contentId: Int!, $reason: String!, $details: String) {
    createReport(flavor: $flavor, contentId: $contentId, reason: $reason, details: $details) {
      id
    }
  }
`;

const REPORT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "porn", label: "Inappropriate content" },
  { value: "copyright", label: "Copyright" },
  { value: "other", label: "Other" },
] as const;

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flavor: "game" | "user" | "comment";
  contentId: number;
  onSubmitted?: () => void;
}

export function ReportDialog({
  open,
  onOpenChange,
  flavor,
  contentId,
  onSubmitted,
}: ReportDialogProps) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [createReport, { loading }] = useMutation(CREATE_REPORT_MUTATION);

  const handleSubmit = async () => {
    if (!reason) return;
    try {
      await createReport({
        variables: { flavor, contentId, reason, details: details || null },
      });
      toast.success("Report submitted");
      onOpenChange(false);
      setReason("");
      setDetails("");
      onSubmitted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit report");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Additional details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!reason || loading}>
            {loading ? "Submitting..." : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { ApiError } from "@/lib/api/client";
import { fetchReviewToken, submitReviewToken } from "@/lib/api/operations";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FormEvent, useState } from "react";

export function ReviewTokenForm({ token }: { token: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ["review-token", token],
    queryFn: () => fetchReviewToken(token),
    retry: false,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      submitReviewToken({
        token,
        rating,
        comment: comment.trim() || undefined,
      }),
    onSuccess: () => {
      setSubmitMessage("Review submitted. Thank you.");
      detailQuery.refetch();
    },
  });

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);
    submitMutation.mutate();
  }

  if (detailQuery.isError) {
    const error = detailQuery.error;
    if (error instanceof ApiError) {
      if (error.status === 410) {
        return <ReviewState title="Review link expired" description="This review link has expired." />;
      }
      if (error.status === 409) {
        return <ReviewState title="Review already submitted" description="A review has already been submitted for this token." />;
      }
      if (error.status === 404) {
        return <ReviewState title="Review link not found" description="This review link is invalid." />;
      }
    }

    return <ReviewState title="Unable to load review" description="Please try again later." />;
  }

  if (detailQuery.isLoading || !detailQuery.data) {
    return <div className="mx-auto mt-20 max-w-lg rounded border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading review details...</div>;
  }

  if (detailQuery.data.isSubmitted) {
    return <ReviewState title="Review already submitted" description="Thank you for sharing your feedback." />;
  }

  return (
    <div className="mx-auto mt-10 max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-2xl font-semibold text-slate-900">Rate your service</h1>
      <p className="text-sm text-slate-600">Job reference: {detailQuery.data.jobId}</p>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Rating</span>
          <select
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            className="w-full rounded border border-slate-300 px-3 py-2"
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Comment (optional)</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2"
            rows={4}
          />
        </label>

        {submitMessage ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{submitMessage}</div> : null}

        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {submitMutation.isPending ? "Submitting..." : "Submit Review"}
        </button>
      </form>
    </div>
  );
}

function ReviewState({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto mt-20 max-w-lg rounded-lg border border-slate-200 bg-white p-6">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}

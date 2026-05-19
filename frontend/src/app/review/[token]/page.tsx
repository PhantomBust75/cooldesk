import { ReviewTokenForm } from "@/components/reviews/review-token-form";

export default async function ReviewTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ReviewTokenForm token={token} />;
}

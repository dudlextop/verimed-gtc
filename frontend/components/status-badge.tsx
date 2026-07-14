import type { ReviewStatus } from "@/lib/types";
import { DomainIndicator } from "./ui";

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <DomainIndicator kind="reviewStatus" level={status} />;
}

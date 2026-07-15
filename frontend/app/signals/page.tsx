import { Suspense } from "react";
import { SignalsView } from "@/components/signals-view";
import { PageSkeleton } from "@/components/foundation";

export default function SignalsPage() {
  return <div className="page-shell"><div id="queue"><Suspense fallback={<PageSkeleton variant="list"/>}><SignalsView/></Suspense></div></div>;
}

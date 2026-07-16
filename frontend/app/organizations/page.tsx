import { Suspense } from "react";
import { OrganizationsView } from "@/components/organizations-view";
import { PageSkeleton } from "@/components/foundation";

export default function OrganizationsPage() {
  return <div className="page-shell"><Suspense fallback={<PageSkeleton variant="list"/>}><OrganizationsView/></Suspense></div>;
}

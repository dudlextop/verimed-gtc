import { Suspense } from "react";
import { OrganizationsView } from "@/components/organizations-view";
import { PageHeader } from "@/components/page-header";
import { PageLoading } from "@/components/data-state";
export default function OrganizationsPage() { return <div className="page-shell"><PageHeader eyebrow="Профиль риска" title="Медицинские организации" description="Сравнивайте объём, структуру услуг и объяснимые отклонения по сопоставимым организациям."/><Suspense fallback={<PageLoading/>}><OrganizationsView/></Suspense></div> }


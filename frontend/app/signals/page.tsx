import { Suspense } from "react";
import { SignalsView } from "@/components/signals-view"; import { PageHeader } from "@/components/page-header"; import { PageLoading } from "@/components/data-state";
export default function SignalsPage() { return <div className="page-shell"><PageHeader eyebrow="Экспертная работа" title="Проверка" description="Приоритетный список медицинских услуг с объяснимыми факторами риска и нейтральной оценкой отклонений."/><div id="queue"><Suspense fallback={<PageLoading/>}><SignalsView/></Suspense></div></div> }

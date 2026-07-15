"use client";

import * as React from "react";
import { Download, RotateCcw, UserRound } from "lucide-react";
import { Button, DataPanel, ExportAction, OverflowActions } from "@/components/foundation";
import { useApi } from "@/hooks/use-api";
import { useFileDownload } from "@/hooks/use-file-download";
import { useLocalProfile } from "@/hooks/use-local-profile";
import { api } from "@/lib/api";
import { mapRegionalMonitoring, unmappedRegionalMonitoring } from "@/lib/region-map";

export function DataActionsShowcase() {
  const [message, setMessage] = React.useState("Инфраструктурные действия не выполнялись");
  const download = useFileDownload((notice) => setMessage(notice.message));
  const profile = useLocalProfile();
  const overview = useApi(() => api.overview(), "foundation-data-actions");
  const mapped = mapRegionalMonitoring(overview.data?.regional_monitoring ?? []);
  const unmapped = unmappedRegionalMonitoring(overview.data?.regional_monitoring ?? []);

  return (
    <section className="space-y-4" aria-labelledby="data-actions-title">
      <h2 id="data-actions-title" className="text-xl font-bold text-v2-text">
        Data/actions infrastructure
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <DataPanel title="Скачивание файлов" description="Общий GET/POST client и состояния ExportAction.">
          <ExportAction
            state={download.state}
            scopeLabel="Текущая выборка"
            message={download.error ?? undefined}
            onAction={async () => {
              await download.run({
                path: "/exports/signals.csv?region=Алматы",
                fallbackFilename: "verimed-signals.csv",
              });
            }}
          />
          <p className="mt-3 text-sm text-v2-text-secondary" role="status">{message}</p>
        </DataPanel>

        <DataPanel title="Локальный профиль" description="Версионированное хранение только для текущего браузера.">
          <p className="text-sm font-semibold text-v2-text">{profile.profile.displayName}</p>
          <p className="text-sm text-v2-text-secondary">{profile.profile.jobTitle} · {profile.source}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="compact"
              onClick={() => profile.update({ displayName: "Эксперт Verimed", initials: "ЭВ" })}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Проверить сохранение
            </Button>
            <Button variant="ghost" size="compact" onClick={profile.reset}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Сбросить
            </Button>
          </div>
        </DataPanel>

        <DataPanel title="Сопоставление регионов" description="Агрегат отсутствующего региона остаётся отсутствующим, а не нулевым.">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-v2-text-secondary">Геометрий</dt><dd className="font-semibold">{mapped.filter((item) => item.geometryFeatureId).length}</dd></div>
            <div><dt className="text-v2-text-secondary">С агрегатами</dt><dd className="font-semibold">{mapped.filter((item) => item.aggregate).length}</dd></div>
            <div><dt className="text-v2-text-secondary">Без данных</dt><dd className="font-semibold">{mapped.filter((item) => !item.aggregate).length}</dd></div>
            <div><dt className="text-v2-text-secondary">Не сопоставлено</dt><dd className="font-semibold">{unmapped.length}</dd></div>
          </dl>
          <a className="mt-4 inline-flex text-sm font-semibold text-v2-primary" href="/maps/kazakhstan-adm1.geojson">
            Открыть статическую геометрию
          </a>
        </DataPanel>

        <DataPanel title="Дополнительные действия" description="В меню видны только пункты с рабочим callback.">
          <OverflowActions
            items={[
              {
                id: "prepare",
                label: "Подготовить выборку",
                icon: <Download className="h-4 w-4" />,
                onSelect: async () => setMessage("Выборка подготовлена"),
              },
              { id: "hidden", label: "Неработающий пункт" },
            ]}
            onActionError={setMessage}
          />
        </DataPanel>
      </div>
    </section>
  );
}

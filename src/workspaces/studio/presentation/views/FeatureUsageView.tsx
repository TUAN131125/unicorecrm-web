import React from "react";
import {
  Blocks,
  ToggleRight,
  LockKeyhole,
  Save,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { useWorkspaceConfigSnapshot } from "@/platform/workspace-config";
import { updateStudioFeatures } from "../../public/studioCore";
import { cn } from "@/shared/lib/classnames/cn";
import { FeatureModuleCard } from "../components/FeatureModuleCard";
import {
  StudioButton,
  StudioEmpty,
  StudioPageFrame,
  StudioSaveBar,
  StudioSearchInput,
  StudioSection,
} from "../components/StudioPrimitives";
import {
  GROUP_TONE_CLASSES,
  MODULE_GROUPS,
  MODULE_META,
  normalizeModuleDraft,
  type ModuleKey,
} from "./featureUsageCatalog";
import { StudioMetricCard } from "../components/StudioExperiencePrimitives";
import { formatApplicationError } from "@/shared/operations";

export function FeatureUsageView() {
  const { t, locale } = useI18n();
  const access = useEffectiveAccess();
  const configuration = useWorkspaceConfigSnapshot();
  const canConfigure = access.can(CAPABILITIES.STUDIO_CONFIGURE);
  const [draft, setDraft] = React.useState(() => normalizeModuleDraft(configuration.modules));
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => setDraft(normalizeModuleDraft(configuration.modules)), [configuration.modules]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(configuration.modules);
  const isEnabled = React.useCallback((module: ModuleKey) => draft[module] !== false, [draft]);
  const save = async (): Promise<boolean> => {
    setSaving(true);
    try {
      await updateStudioFeatures(draft);
      setError("");
      return true;
    } catch (cause) {
      setError(formatApplicationError(cause, { locale }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const moduleCount = MODULE_GROUPS.reduce((count, group) => count + group.modules.length, 0);
  const enabledCount = MODULE_GROUPS.reduce((count, group) => count + group.modules.filter(isEnabled).length, 0);
  const normalizedSearch = search.trim().toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
  const visibleGroups = MODULE_GROUPS.map((group) => ({
    ...group,
    modules: group.modules.filter((module) => {
      if (!normalizedSearch) return true;
      const meta = MODULE_META[module];
      const searchable = [
        t(`settings.crmConfig.modules.${module}`),
        t(meta.descriptionKey),
        t(meta.scopeKey),
        t(group.titleKey),
      ].join(" ").toLocaleLowerCase(locale === "vi" ? "vi-VN" : "en-US");
      return searchable.includes(normalizedSearch);
    }),
  })).filter((group) => group.modules.length > 0);
  const visibleCount = visibleGroups.reduce((count, group) => count + group.modules.length, 0);

  return (
    <StudioPageFrame
      title={t("studio.featureUsage")}
      description={t("studio.features.description")}
      locale={locale}
      dirty={dirty}
      error={error}
      actions={<StudioButton tone="primary" icon={<Save size={16} />} loading={saving} disabled={!canConfigure || !dirty || saving} onClick={() => void save()}>{t("common.save")}</StudioButton>}
    >
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t("studio.readOnly")}</p> : null}

      <div className="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,14rem),1fr))]">
        <StudioMetricCard
          label={t("studio.features.metrics.enabled")}
          value={enabledCount}
          icon={<ToggleRight size={17} aria-hidden="true" />}
          tone="violet"
        />
        <StudioMetricCard
          label={t("studio.features.metrics.groups")}
          value={MODULE_GROUPS.length}
          icon={<Blocks size={17} aria-hidden="true" />}
          tone="info"
        />
        <StudioMetricCard
          label={t("studio.features.metrics.required")}
          value={1}
          icon={<LockKeyhole size={17} aria-hidden="true" />}
          tone="warning"
        />
      </div>

      <StudioSection title={t("studio.features.catalog.title")} className="mt-5 min-w-0">
        <p className="max-w-3xl text-sm font-normal leading-6 text-slate-500">{t("studio.features.catalog.description")}</p>
        <div className="mt-4 min-w-0 border-b border-slate-100 pb-5">
          <StudioSearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("studio.features.catalog.searchPlaceholder")}
            aria-label={t("studio.features.catalog.searchLabel")}
            className="w-full sm:max-w-xl"
          />
        </div>

        <p className="mt-4 text-xs font-normal text-slate-500" aria-live="polite">
          {t("studio.features.catalog.resultCount", { visible: visibleCount, total: moduleCount })}
        </p>

        {visibleGroups.length > 0 ? (
          <div className="mt-5 space-y-8">
            {visibleGroups.map((group) => {
              const GroupIcon = group.icon;
              const groupEnabledCount = group.modules.filter(isEnabled).length;
              const tone = GROUP_TONE_CLASSES[group.tone];
              return (
                <section key={group.id} className="min-w-0" aria-labelledby={`feature-group-${group.id}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tone.icon)}>
                      <GroupIcon size={19} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 id={`feature-group-${group.id}`} className="text-sm font-semibold text-slate-950 [overflow-wrap:anywhere]">{t(group.titleKey)}</h2>
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium", tone.count)}>{groupEnabledCount}/{group.modules.length}</span>
                      </div>
                      <p className="mt-1 max-w-3xl text-xs font-normal leading-5 text-slate-500">{t(group.descriptionKey)}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
                    {group.modules.map((module) => {
                      const meta = MODULE_META[module];
                      return (
                        <FeatureModuleCard
                          key={module}
                          module={module}
                          icon={meta.icon}
                          label={t(`settings.crmConfig.modules.${module}`)}
                          description={t(meta.descriptionKey)}
                          scope={t(meta.scopeKey)}
                          enabled={isEnabled(module)}
                          required={module === "customers"}
                          canConfigure={canConfigure}
                          requiredLabel={t("studio.features.catalog.requiredLabel")}
                          toggleLabel={t("studio.features.catalog.toggleLabel")}
                          onChange={(checked) => setDraft((current) => ({ ...current, [module]: checked }))}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-5">
            <StudioEmpty
              title={t("studio.features.catalog.emptyTitle")}
              description={t("studio.features.catalog.emptyDescription")}
            />
          </div>
        )}
      </StudioSection>

      <StudioSaveBar dirty={dirty && canConfigure} saving={saving} onSave={async () => { await save(); }} saveLabel={t("common.save")} cleanLabel={t("studio.saved")} dirtyLabel={t("studio.unsaved")} />
    </StudioPageFrame>
  );
}

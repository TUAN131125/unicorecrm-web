import React from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { CAPABILITIES, useEffectiveAccess } from "@/platform/access-control";
import { type ExchangeRate, useWorkspaceOperationalConfiguration } from "@/platform/workspace-config";
import { updateStudioLocaleRegion } from "../../public/studioCore";
import { getCurrencyMinorUnit, invertDecimal, listIsoCurrencies } from "@/shared/money";
import {
  StudioButton,
  StudioField,
  StudioInput,
  StudioPageFrame,
  StudioSaveBar,
  StudioSection,
  StudioSelect,
} from "../components/StudioPrimitives";
import { formatApplicationError } from "@/shared/operations";

export function LocaleRegionView() {
  const { t, locale, setLocale } = useI18n();
  const access = useEffectiveAccess();
  const configuration = useWorkspaceOperationalConfiguration();
  const canConfigure = access.can(CAPABILITIES.STUDIO_CONFIGURE);
  const [draft, setDraft] = React.useState(configuration.localeRegion);
  const [currencyToAdd, setCurrencyToAdd] = React.useState("");
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const rateInputRef = React.useRef<HTMLInputElement>(null);
  const currencies = React.useMemo(() => listIsoCurrencies(locale), [locale]);

  React.useEffect(() => setDraft(configuration.localeRegion), [configuration.localeRegion]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(configuration.localeRegion);

  const save = async (): Promise<boolean> => {
    const invalidRate = draft.exchangeRates.find((rate) => !/^\d+(?:\.\d+)?$/.test(rate.rate) || Number(rate.rate) <= 0);
    if (invalidRate) {
      setError(t("studio.validation.exchangeRate"));
      rateInputRef.current?.focus();
      return false;
    }
    if (!draft.currencies.enabledCurrencies.includes(draft.currencies.baseCurrency)) {
      setError(t("studio.validation.baseCurrencyEnabled"));
      return false;
    }
    setSaving(true);
    setMessage("");
    try {
      await updateStudioLocaleRegion(draft);
      setLocale(draft.defaultLocale);
      setError("");
      setMessage(t("common.updatedSuccessfully"));
      return true;
    } catch (cause) {
      setError(formatApplicationError(cause, { locale }));
      return false;
    } finally {
      setSaving(false);
    }
  };


  const addCurrency = () => {
    if (!currencyToAdd || draft.currencies.enabledCurrencies.includes(currencyToAdd)) return;
    setDraft((current) => ({ ...current, currencies: { ...current.currencies, enabledCurrencies: [...current.currencies.enabledCurrencies, currencyToAdd] } }));
    setCurrencyToAdd("");
  };

  const removeCurrency = (currency: string) => {
    if (currency === draft.currencies.baseCurrency) return;
    setDraft((current) => ({
      ...current,
      currencies: { ...current.currencies, enabledCurrencies: current.currencies.enabledCurrencies.filter((item) => item !== currency) },
    }));
  };

  const addRate = () => setDraft((current) => ({
    ...current,
    exchangeRates: [...current.exchangeRates, {
      id: `rate-${crypto.randomUUID()}`,
      fromCurrency: current.currencies.enabledCurrencies.find((item) => item !== current.currencies.baseCurrency) ?? current.currencies.baseCurrency,
      toCurrency: current.currencies.baseCurrency,
      rate: "",
      effectiveAt: new Date().toISOString().slice(0, 10),
      source: "MANUAL",
      providerConnectionId: null,
      status: "ACTIVE",
      version: 1,
    }],
  }));

  const updateRate = (id: string, patch: Partial<ExchangeRate>) => setDraft((current) => ({ ...current, exchangeRates: current.exchangeRates.map((rate) => rate.id === id ? { ...rate, ...patch } : rate) }));

  const content = (
    <>
      {!canConfigure ? <p className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{t("studio.readOnly")}</p> : null}
      <div className="space-y-5">
        <StudioSection title={t("studio.locale.languageRegion")}>
          <div className="grid gap-4 md:grid-cols-2">
            <StudioField label={t("studio.locale.defaultLanguage")}><StudioSelect disabled={!canConfigure} value={draft.defaultLocale} onChange={(event) => setDraft((current) => ({ ...current, defaultLocale: event.target.value as "vi" | "en" }))}><option value="vi">Tiếng Việt</option><option value="en">English</option></StudioSelect></StudioField>
            <StudioField label={t("studio.locale.timezone")}><StudioInput disabled={!canConfigure} value={draft.timezone} onChange={(event) => setDraft((current) => ({ ...current, timezone: event.target.value }))} /></StudioField>
            <StudioField label={t("studio.locale.country")}><StudioInput disabled={!canConfigure} value={draft.countryCode} onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} /></StudioField>
            <StudioField label={t("studio.locale.dateFormat")}><StudioSelect disabled={!canConfigure} value={draft.dateFormat} onChange={(event) => setDraft((current) => ({ ...current, dateFormat: event.target.value as typeof current.dateFormat }))}><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></StudioSelect></StudioField>
          </div>
        </StudioSection>

        <StudioSection title={t("studio.locale.currencies")} description={t("studio.locale.currencyDescription")}>
          <div className="grid gap-4 md:grid-cols-3">
            <StudioField label={t("studio.locale.baseCurrency")}><StudioSelect disabled={!canConfigure} value={draft.currencies.baseCurrency} onChange={(event) => setDraft((current) => ({ ...current, currencies: { ...current.currencies, baseCurrency: event.target.value, enabledCurrencies: [...new Set([...current.currencies.enabledCurrencies, event.target.value])] } }))}>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} · {currency.minorUnit} {t("studio.locale.minorUnits")}</option>)}</StudioSelect></StudioField>
            <StudioField label={t("studio.locale.displayMode")}><StudioSelect disabled={!canConfigure} value={draft.currencies.displayMode} onChange={(event) => setDraft((current) => ({ ...current, currencies: { ...current.currencies, displayMode: event.target.value as "FULL" | "COMPACT" } }))}><option value="FULL">{t("studio.locale.full")}</option><option value="COMPACT">{t("studio.locale.compact")}</option></StudioSelect></StudioField>
            <StudioField label={t("studio.locale.rateMode")}><StudioSelect disabled={!canConfigure} value={draft.currencies.exchangeRateMode} onChange={(event) => setDraft((current) => ({ ...current, currencies: { ...current.currencies, exchangeRateMode: event.target.value as "MANUAL" | "CONNECTED_PROVIDER" } }))}><option value="MANUAL">{t("studio.locale.manual")}</option><option value="CONNECTED_PROVIDER">{t("studio.locale.provider")}</option></StudioSelect></StudioField>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{draft.currencies.enabledCurrencies.map((currency) => <span key={currency} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-sm">{currency} ({getCurrencyMinorUnit(currency)}){canConfigure && currency !== draft.currencies.baseCurrency ? <button type="button" onClick={() => removeCurrency(currency)} aria-label={t("common.remove")}>×</button> : null}</span>)}</div>
          {canConfigure ? <div className="mt-4 flex gap-2"><StudioSelect value={currencyToAdd} onChange={(event) => setCurrencyToAdd(event.target.value)}><option value="">{t("studio.locale.addCurrency")}</option>{currencies.filter((currency) => !draft.currencies.enabledCurrencies.includes(currency.code)).map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}</StudioSelect><StudioButton tone="accent" icon={<Plus size={15} />} onClick={addCurrency}>{t("common.add")}</StudioButton></div> : null}
        </StudioSection>

        <StudioSection
          title={t("studio.locale.exchangeRates")}
          description={t("studio.locale.rateExplanation")}
          actions={canConfigure ? <StudioButton tone="accent" icon={<Plus size={15} />} onClick={addRate}>{t("common.add")}</StudioButton> : undefined}
        >
          {draft.exchangeRates.length ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {draft.exchangeRates.map((rate, index) => {
                const hasValidRate = /^\d+(?:\.\d+)?$/.test(rate.rate) && Number(rate.rate) > 0;
                return (
                  <article key={rate.id} className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                      <StudioField label={t("studio.locale.from")}>
                        <StudioSelect disabled={!canConfigure} value={rate.fromCurrency} onChange={(event) => updateRate(rate.id, { fromCurrency: event.target.value })}>
                          {draft.currencies.enabledCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
                        </StudioSelect>
                      </StudioField>
                      <StudioField label={t("studio.locale.to")}>
                        <StudioSelect disabled={!canConfigure} value={rate.toCurrency} onChange={(event) => updateRate(rate.id, { toCurrency: event.target.value })}>
                          {draft.currencies.enabledCurrencies.map((currency) => <option key={currency}>{currency}</option>)}
                        </StudioSelect>
                      </StudioField>
                      <StudioField label={t("common.rate")}>
                        <StudioInput
                          ref={index === 0 ? rateInputRef : undefined}
                          disabled={!canConfigure}
                          inputMode="decimal"
                          value={rate.rate}
                          onChange={(event) => updateRate(rate.id, { rate: event.target.value, version: rate.version + 1 })}
                        />
                      </StudioField>
                      <StudioField label={t("studio.locale.effectiveAt")}>
                        <StudioInput
                          type="date"
                          disabled={!canConfigure}
                          value={rate.effectiveAt.slice(0, 10)}
                          onChange={(event) => updateRate(rate.id, { effectiveAt: event.target.value })}
                        />
                      </StudioField>
                    </div>
                    <div className="mt-4 flex min-w-0 flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{t("studio.locale.inverse")}</p>
                        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
                          {hasValidRate ? `1 ${rate.toCurrency} = ${invertDecimal(rate.rate)} ${rate.fromCurrency}` : "—"}
                        </p>
                      </div>
                      {canConfigure ? (
                        <StudioButton
                          size="sm"
                          tone="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => setDraft((current) => ({ ...current, exchangeRates: current.exchangeRates.filter((item) => item.id !== rate.id) }))}
                        >
                          {t("common.remove")}
                        </StudioButton>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
              {t("studio.locale.noRates")}
            </div>
          )}
        </StudioSection>
      </div>
    </>
  );


  return (
    <StudioPageFrame title={t("studio.localeRegion")} description={t("studio.locale.description")} locale={locale} revision={configuration.revision} updatedAt={configuration.updatedAt} dirty={dirty} error={error} message={message} actions={<StudioButton tone="primary" icon={<Save size={16} />} disabled={!canConfigure || !dirty || saving} loading={saving} onClick={() => void save()}>{t("common.save")}</StudioButton>}>
      {content}
      <StudioSaveBar dirty={dirty && canConfigure} saving={saving} onSave={async () => { await save(); }} saveLabel={t("common.save")} cleanLabel={t("studio.saved")} dirtyLabel={t("studio.unsaved")} />
    </StudioPageFrame>
  );
}

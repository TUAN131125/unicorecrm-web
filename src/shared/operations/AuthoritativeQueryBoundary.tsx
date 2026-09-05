import React from "react";
import { ListStatePanel } from "@/components/crm/list-archetype";
import { Button } from "@/shared/components/ui";
import { useI18n } from "@/i18n";
import type { ApplicationError } from "@/shared/domain";
import { AuthoritativeQueryNotice } from "./AuthoritativeQueryNotice";
import { formatApplicationError } from "./errorPresentation";

export interface AuthoritativeQueryViewState {
  connected: boolean;
  loading: boolean;
  refreshing: boolean;
  stale: boolean;
  loadedAt?: string;
  error?: ApplicationError;
  refresh: () => Promise<unknown>;
  cancel: () => void;
}

interface AuthoritativeQueryBoundaryProps {
  query: AuthoritativeQueryViewState;
  hasData: boolean;
  loadingTitleVi: string;
  loadingTitleEn: string;
  errorTitleVi: string;
  errorTitleEn: string;
  children: React.ReactNode;
  showNotice?: boolean;
}

export const AuthoritativeQueryBoundary: React.FC<AuthoritativeQueryBoundaryProps> = ({
  query,
  hasData,
  loadingTitleVi,
  loadingTitleEn,
  errorTitleVi,
  errorTitleEn,
  children,
  showNotice = true,
}) => {
  const { locale } = useI18n();
  const text = (vi: string, en: string) => locale === "vi" ? vi : en;

  if (query.connected && query.loading && !hasData) {
    return (
      <ListStatePanel
        kind="loading"
        title={text(loadingTitleVi, loadingTitleEn)}
        action={(
          <Button type="button" variant="secondary" size="sm" onClick={query.cancel}>
            {text("Hủy", "Cancel")}
          </Button>
        )}
      />
    );
  }

  if (query.connected && query.error && !hasData) {
    return (
      <ListStatePanel
        kind="error"
        title={text(errorTitleVi, errorTitleEn)}
        description={formatApplicationError(query.error, {
          locale,
          fallbackMessage: text("Không thể tải dữ liệu.", "The data could not be loaded."),
        })}
        action={(
          <Button type="button" variant="secondary" size="sm" onClick={() => void query.refresh()}>
            {text("Thử lại", "Retry")}
          </Button>
        )}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-3" data-authoritative-query-boundary>
      {showNotice && (
        <AuthoritativeQueryNotice
          connected={query.connected}
          loading={query.loading}
          refreshing={query.refreshing}
          stale={query.stale}
          loadedAt={query.loadedAt}
          error={query.error}
          onRefresh={() => void query.refresh()}
        />
      )}
      {children}
    </div>
  );
};

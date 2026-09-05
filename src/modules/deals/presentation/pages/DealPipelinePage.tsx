import React from "react";
import { motion, AnimatePresence, LayoutGroup } from "motion/react";
import { TrendingUp, AlertTriangle, User, RefreshCw, Download, Upload, RotateCcw, MoreHorizontal, ArrowRight, LoaderCircle, Plus } from "lucide-react";
import { DealStage } from "../../domain/model/deal.types";
import { PageHeader, Button, Input, Select, Table, TableHeader, TableBody, TableRow, TableCell, Badge, IconButton, RowActionPortal } from "@/shared/components/ui";
import { ModulePageShell } from "@/components/crm/ModulePageShell";
import { PageHeaderMoreButton } from "@/components/crm/PageHeaderActions";
import { ActionDropdown } from "@/components/crm/ActionDropdown";
import { formatCurrency, formatCurrencyTotals } from "@/shared/lib/format/currency";
import { formatDate, formatDateTime } from "@/shared/lib/format/date";
import { useDealPipelineController } from "../hooks/useDealPipelineController";
import { DealPipelineModals } from "../components/DealPipelineModals";
import { DealActionMenu } from "../components/DealActionMenu";
import { notifyProduct } from "@/components/feedback/ProductDialogService";
import { AuthoritativeQueryBoundary } from "@/shared/operations";
import { OwnershipScopeSelector } from "@/components/crm/OwnershipScopeSelector";
import { ListFilterGrid, ListFilterPopover, ListToolbar } from "@/components/crm/list-archetype";
import { DealPipelineHealthBadges } from "../components/DealPipelineHealth";
import { resolveWorkspaceMemberLabel } from "@/platform/member-directory";

export const DealPipelinePage = () => {
  const controller = useDealPipelineController();
  const {
    deals,
    query: dealQuery,
    stageWindowQuery,
    ownership,
    ownershipScope,
    setOwnershipScope,
    ownershipScopeCounts,
    navigate,
    t,
    locale,
    viewMode,
    searchTerm,
    setSearchTerm,
    ownerFilter,
    setOwnerFilter,
    stageFilter,
    setStageFilter,
    dateStatusFilter,
    setDateStatusFilter,
    minAmountFilter,
    setMinAmountFilter,
    currencyFilter,
    setCurrencyFilter,
    setIsAddModalOpen,
    isFilterOpen,
    setIsFilterOpen,
    isMoreActionsOpen,
    setIsMoreActionsOpen,
    moreActionsAnchor,
    setMoreActionsAnchor,
    stageConfigs,
    activeActionsDealId,
    setActiveActionsDealId,
    draggingId,
    setDraggingId,
    draggedOverStage,
    setDraggedOverStage,
    draggedOverCardId,
    setDraggedOverCardId,
    setViewMode,
    handleDropCard,
    getDealStageLabel,
    isOverdue,
    getNextDealStage,
    isDealAdvancing,
    advanceDealStage,
    handleOpenEditModal,
    handleDuplicateDeal,
    handleDeleteDeal,
    handleMarkWonDirect,
    handleMarkLostDirect,
    handleExportCSV,
    handleImportDummyLeads,
    handleResetStageConfigs,
    filteredDeals,
    pipelineStages,
    activeFilterCount,
  } = controller;

  const [rowActionAnchorEl, setRowActionAnchorEl] =
    React.useState<HTMLElement | null>(null);
  const [droppingId, setDroppingId] = React.useState<string | null>(null);
  const dropPendingRef = React.useRef<string | null>(null);
  const activeActionsDeal =
    deals.find((deal) => deal.id === activeActionsDealId) ?? null;
  const dealCurrencies = React.useMemo(
    () => Array.from(new Set(deals.map((deal) => deal.currency || "VND"))).sort(),
    [deals],
  );

  const closeRowActions = () => {
    setActiveActionsDealId(null);
    setRowActionAnchorEl(null);
  };

  const clearDealDragState = () => {
    setDraggingId(null);
    setDraggedOverStage(null);
    setDraggedOverCardId(null);
  };

  const completeDealDrop = async (
    draggedId: string,
    targetStage: string,
    targetCardId?: string,
  ) => {
    if (dropPendingRef.current) return;
    dropPendingRef.current = draggedId;
    setDroppingId(draggedId);
    try {
      await handleDropCard(draggedId, targetStage, targetCardId);
    } catch {
      notifyProduct(
        locale === "vi"
          ? "Không thể di chuyển cơ hội. Vui lòng thử lại."
          : "The opportunity could not be moved. Please try again.",
        "danger",
      );
    } finally {
      if (dropPendingRef.current === draggedId) dropPendingRef.current = null;
      setDroppingId((current) => (current === draggedId ? null : current));
      clearDealDragState();
    }
  };

  return (
    <AuthoritativeQueryBoundary
      query={dealQuery}
      hasData={deals.length > 0}
      loadingTitleVi="Đang tải danh sách cơ hội"
      loadingTitleEn="Loading deals"
      errorTitleVi="Không thể tải danh sách cơ hội"
      errorTitleEn="Deals could not be loaded"
    >
    <ModulePageShell
      id="deal-pipeline-page"
      className={`relative ${
        viewMode === "kanban"
          ? "flex h-[calc(100dvh-84px)] min-h-[520px] flex-col pb-0"
          : ""
      }`}
    >
      {/* Page Header */}
      <PageHeader
        title={t("deals.title")}
        icon={<TrendingUp size={18} />}
        className="mb-0"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setIsAddModalOpen(true)}
              className="h-9 whitespace-nowrap rounded-xl"
            >
              {t("deals.addDeal")}
            </Button>
            <div>
              <PageHeaderMoreButton
                active={isMoreActionsOpen}
                onClick={(event) => {
                  setMoreActionsAnchor(event.currentTarget);
                  setIsMoreActionsOpen(!isMoreActionsOpen);
                }}
                title={t("opportunities.actions.more", "Thao tác khác")}
                aria-label={t("opportunities.actions.more", "Thao tác khác")}
                aria-haspopup="menu"
                aria-expanded={isMoreActionsOpen}
                className="focus:outline-none focus:ring-2 focus:ring-violet-500/30"
              />
              {isMoreActionsOpen && (
                <ActionDropdown
                  isOpen={isMoreActionsOpen}
                  anchorRef={moreActionsAnchor}
                  onClose={() => {
                    setIsMoreActionsOpen(false);
                    setMoreActionsAnchor(null);
                  }}
                  sections={[
                    {
                      id: "import-export",
                      title: t(
                        "common.importExport",
                        locale === "vi" ? "Nhập / Xuất dữ liệu" : "Import / Export",
                      ),
                      items: [
                        {
                          id: "import-deals",
                          label: t("opportunities.actions.import"),
                          icon: <Upload size={13} />,
                          onClick: handleImportDummyLeads,
                        },
                        {
                          id: "export-deals",
                          label: t("opportunities.actions.export"),
                          icon: <Download size={13} />,
                          onClick: handleExportCSV,
                        },
                      ],
                    },
                    {
                      id: "actions",
                      title: t(
                        "common.actions",
                        locale === "vi" ? "Thao tác" : "Actions",
                      ),
                      items: [
                        {
                          id: "refresh-deals",
                          label: t("opportunities.actions.forceRefresh"),
                          icon: <RefreshCw size={13} />,
                          onClick: () =>
                            notifyProduct(
                              t("opportunities.actions.forceRefresh"),
                              "info",
                            ),
                        },
                        {
                          id: "reset-pipeline",
                          label: t("opportunities.actions.resetStages"),
                          icon: <RotateCcw size={13} />,
                          onClick: handleResetStageConfigs,
                          destructive: true,
                        },
                      ],
                    },
                  ]}
                  width={224}
                />
              )}
            </div>
          </div>
        }
      />

      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={t("deals.filters.searchPlaceholder", "Tìm theo tên, mã cơ hội...")}
        controlsPrefix={
          <OwnershipScopeSelector
            value={ownershipScope}
            onChange={setOwnershipScope}
            context={ownership}
            locale={locale}
            counts={ownershipScopeCounts}
            guidancePrefix="deals.pipeline"
            compact
          />
        }
        compactControls
        controlsClassName="gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
        viewMode={viewMode as "kanban" | "table"}
        onViewModeChange={(mode) => {
          closeRowActions();
          setViewMode(mode as "kanban" | "table");
        }}
        viewOptions={[
          { value: "kanban", label: t("opportunities.actions.viewKanban", "Xem dạng Kanban") },
          { value: "table", label: t("opportunities.actions.viewList", "Xem dạng danh sách") },
        ]}
        showFilters
        onOpenFilters={() => setIsFilterOpen((open) => !open)}
        onCloseFilters={() => setIsFilterOpen(false)}
        filtersOpen={isFilterOpen}
        filtersPanel={
          <ListFilterPopover
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            onReset={() => {
              setOwnerFilter("all");
              setStageFilter("all");
              setDateStatusFilter("all");
              setMinAmountFilter("");
              setCurrencyFilter("all");
            }}
            ariaLabel={t("opportunities.filters.title")}
            resetLabel={t("common.reset")}
            doneLabel={locale === "vi" ? "Hoàn tất" : "Done"}
          >
            <ListFilterGrid>
              <Select
                label={t("deals.filters.owner")}
                value={ownerFilter}
                onChange={(event) => setOwnerFilter(event.target.value)}
              >
                <option value="all">{t("deals.filters.all")}</option>
                {(ownership?.visibleOwners || []).map((owner) => (
                  <option key={owner.memberId} value={owner.memberId}>
                    {owner.displayName}
                  </option>
                ))}
              </Select>

              <Select
                label={t("deals.filters.stage")}
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
              >
                <option value="all">{t("deals.filters.all")}</option>
                {pipelineStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {getDealStageLabel(stage)}
                  </option>
                ))}
              </Select>

              <Select
                label={t("deals.filters.closeDate")}
                value={dateStatusFilter}
                onChange={(event) => setDateStatusFilter(event.target.value)}
              >
                <option value="all">{t("deals.filters.all")}</option>
                <option value="overdue">{t("deals.filters.overdue")}</option>
                <option value="month">{t("deals.filters.closingThisMonth")}</option>
              </Select>

              <Select
                label={locale === "vi" ? "Tiền tệ" : "Currency"}
                value={currencyFilter}
                onChange={(event) => {
                  setCurrencyFilter(event.target.value);
                  setMinAmountFilter("");
                }}
              >
                <option value="all">{locale === "vi" ? "Tất cả tiền tệ" : "All currencies"}</option>
                {dealCurrencies.map((currency) => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </Select>

              <Input
                label={t("deals.filters.amountRange")}
                type="number"
                inputMode="decimal"
                placeholder={t("deals.filters.minAmountPlaceholder")}
                value={minAmountFilter}
                disabled={currencyFilter === "all"}
                onChange={(event) => setMinAmountFilter(event.target.value)}
              />
            </ListFilterGrid>
          </ListFilterPopover>
        }
        activeFilterCount={activeFilterCount}
        hasActiveFilters={activeFilterCount > 0}
        filtersLabel={t("opportunities.actions.filter", "Lọc cơ hội")}
        className="rounded-2xl border-slate-200 bg-white shadow-sm"
      />


      {/* 4. Display views (Kanban vs Table/Cards) */}
      {viewMode === "kanban" ? (
        /* KANBAN GRID BOARD VIEW (With isolated horizontal scrollbar) */
        <div
          id="deals-kanban-section"
          className="flex-1 min-h-0 overflow-hidden"
        >
          <div className="h-full min-h-0 overflow-x-auto overflow-y-hidden pb-3 crm-scroll-x">
            <LayoutGroup id="deal-pipeline-kanban">
              <div className="flex h-full min-w-max gap-4 pb-1 select-none items-stretch">
                {pipelineStages.map((stage) => {
                  const stageDeals = filteredDeals.filter(
                    (d) => d.stage === stage,
                  );
                  const stageCurrencySummary = formatCurrencyTotals(
                    stageDeals.map((deal) => ({ amount: deal.amount, currency: deal.currency })),
                    locale,
                  );

                  return (
                    <div
                      key={stage}
                      data-deal-kanban-column={stage}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (draggedOverStage !== stage) {
                          setDraggedOverStage(stage);
                        }
                        if (
                          !(e.target as HTMLElement).closest(
                            '[data-deal-kanban-card="balanced"]',
                          )
                        ) {
                          setDraggedOverCardId(null);
                        }
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (draggedOverStage !== stage) {
                          setDraggedOverStage(stage);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const draggedId =
                          e.dataTransfer.getData("text/plain") || draggingId;
                        if (draggedId) {
                          void completeDealDrop(
                            draggedId,
                            stage,
                            draggedOverCardId || undefined,
                          );
                        }
                      }}
                      className={`flex h-full w-[294px] shrink-0 flex-col overflow-hidden rounded-2xl border transition-[border-color,background-color,box-shadow] duration-200 ${
                        draggedOverStage === stage
                          ? "border-indigo-400 bg-indigo-50/45 shadow-md ring-2 ring-indigo-500/15"
                          : "border-slate-200 bg-slate-50/70 shadow-sm"
                      }`}
                    >
                      {/* Column Header */}
                      <div className="shrink-0 border-b border-slate-200 bg-slate-100/40 px-4 py-3">
                        <div className="flex justify-between items-center mb-1 gap-1">
                          <span
                            className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wide crm-text-wrap max-w-[190px]"
                            title={getDealStageLabel(stage)}
                          >
                            {getDealStageLabel(stage)}
                          </span>
                          <span className="bg-slate-200/85 text-slate-800 px-2 py-0.5 rounded-full font-extrabold text-[10px] shrink-0">
                            {viewMode === "kanban" && stageWindowQuery.connected
                              ? `${stageWindowQuery.loadedCount(stage)}/${stageWindowQuery.totalCount(stage)}`
                              : stageDeals.length}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-extrabold block text-left">
                          {stageCurrencySummary || formatCurrency(0, "VND", locale)}
                        </span>
                      </div>

                      {/* The whole column body is a drop target; card hover only refines insertion order. */}
                      <div
                        data-deal-kanban-dropzone="full-column"
                        className={`relative flex min-h-0 flex-1 flex-col overflow-y-auto p-4 transition-colors duration-200 crm-scroll-y ${
                          draggingId && draggedOverStage === stage
                            ? "bg-indigo-50/35"
                            : ""
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (draggedOverStage !== stage)
                            setDraggedOverStage(stage);
                          if (
                            !(e.target as HTMLElement).closest(
                              '[data-deal-kanban-card="balanced"]',
                            )
                          ) {
                            setDraggedOverCardId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const draggedId =
                            e.dataTransfer.getData("text/plain") || draggingId;
                          if (draggedId) {
                            void completeDealDrop(
                              draggedId,
                              stage,
                              draggedOverCardId || undefined,
                            );
                          }
                        }}
                      >
                        <AnimatePresence initial={false}>
                          {draggingId && draggedOverStage === stage && (
                            <motion.div
                              key={`dropzone-${stage}`}
                              data-deal-kanban-drop-indicator="full-column"
                              initial={{ opacity: 0, scale: 0.985 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.99 }}
                              transition={{ duration: 0.14, ease: "easeOut" }}
                              className="pointer-events-none absolute inset-2 z-0 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/35 shadow-inner"
                            />
                          )}
                        </AnimatePresence>

                        <div className="relative z-10 flex min-h-full flex-col gap-2.5">
                          <AnimatePresence initial={false}>
                            {stageDeals.map((deal, dealIndex) => {
                              const ownerLabel = resolveWorkspaceMemberLabel(
                                deal.ownerId,
                                locale,
                              );
                              const dealOverdue = isOverdue(
                                deal.expectedCloseDate,
                                deal.stage,
                              );
                              const isBeingDragged = draggingId === deal.id;
                              const isDropSettling = droppingId === deal.id;

                              return (
                                <React.Fragment key={deal.id}>
                                  <AnimatePresence initial={false}>
                                    {draggedOverCardId === deal.id &&
                                      draggingId !== deal.id && (
                                        <motion.div
                                          key={`insert-before-${deal.id}`}
                                          data-deal-kanban-insertion="before-card"
                                          initial={{
                                            height: 0,
                                            opacity: 0,
                                            scaleX: 0.75,
                                          }}
                                          animate={{
                                            height: 8,
                                            opacity: 1,
                                            scaleX: 1,
                                          }}
                                          exit={{
                                            height: 0,
                                            opacity: 0,
                                            scaleX: 0.8,
                                          }}
                                          transition={{
                                            duration: 0.12,
                                            ease: "easeOut",
                                          }}
                                          className="flex shrink-0 origin-center items-center px-1"
                                        >
                                          <span className="h-1 w-full rounded-full bg-indigo-400 shadow-sm" />
                                        </motion.div>
                                      )}
                                  </AnimatePresence>

                                  <motion.div
                                    layout="position"
                                    layoutId={`deal-kanban-card-${deal.id}`}
                                    initial={false}
                                    animate={{
                                      opacity:
                                        isBeingDragged || isDropSettling
                                          ? 0.3
                                          : 1,
                                      scale: isBeingDragged ? 0.985 : 1,
                                    }}
                                    exit={{ opacity: 0, scale: 0.97 }}
                                    transition={{
                                      layout: {
                                        type: "spring",
                                        stiffness: 430,
                                        damping: 38,
                                        mass: 0.72,
                                      },
                                      opacity: { duration: 0.15 },
                                      scale: { duration: 0.15 },
                                    }}
                                    draggable
                                    onDragStartCapture={(e) => {
                                      setDraggingId(deal.id);
                                      setDroppingId(null);
                                      e.dataTransfer.setData(
                                        "text/plain",
                                        deal.id,
                                      );
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEndCapture={() => {
                                      if (dropPendingRef.current === deal.id)
                                        return;
                                      clearDealDragState();
                                    }}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      e.dataTransfer.dropEffect = "move";
                                      if (!draggingId) return;
                                      if (draggingId === deal.id) {
                                        setDraggedOverCardId(null);
                                        return;
                                      }
                                      if (draggedOverStage !== stage)
                                        setDraggedOverStage(stage);
                                      const bounds =
                                        e.currentTarget.getBoundingClientRect();
                                      const insertAfter =
                                        e.clientY >
                                        bounds.top + bounds.height / 2;
                                      const nextDealId =
                                        stageDeals[dealIndex + 1]?.id;
                                      setDraggedOverCardId(
                                        insertAfter
                                          ? (nextDealId ?? null)
                                          : deal.id,
                                      );
                                    }}
                                    data-deal-kanban-card="balanced"
                                    className={`relative flex min-h-[350px] w-full min-w-0 cursor-grab flex-col gap-3 overflow-hidden rounded-xl border p-4 text-xs shadow-sm transition-[border-color,background-color,box-shadow] hover:border-indigo-200 hover:shadow-md active:cursor-grabbing ${
                                      isBeingDragged || isDropSettling
                                        ? "border-indigo-400 border-dashed bg-slate-50 shadow-inner"
                                        : dealOverdue
                                          ? "border-red-200 hover:border-red-400 bg-red-50/10"
                                          : "border-slate-200 bg-white"
                                    }`}
                                    onClick={() =>
                                      navigate(`/deals/${deal.id}`, {
                                        state: {
                                          returnTo: `/deals?view=kanban`,
                                          sourceView: "kanban",
                                        },
                                      })
                                    }
                                  >
                                    {/* Heading with 3-dot dropdown trigger */}
                                    <div className="flex justify-between items-start gap-1 pb-1">
                                      <div className="space-y-1 min-w-0 flex-1 text-left">
                                        <span
                                          className="block crm-text-wrap text-[12px] font-semibold leading-snug text-indigo-700 hover:underline"
                                          title={deal.name}
                                        >
                                          {deal.name}
                                        </span>
                                        <p className="crm-text-wrap text-[10px] font-normal leading-snug text-slate-500">
                                          {t("deals.card.customer")}:{" "}
                                          <span className="crm-text-wrap font-medium text-slate-700">
                                            {deal.customerName}
                                          </span>
                                        </p>
                                      </div>

                                      {/* Shared Contact-style row action trigger; menu is portaled outside the Kanban scroll container. */}
                                      <div className="shrink-0">
                                        <IconButton
                                          type="button"
                                          variant="secondary"
                                          size="xs"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            if (
                                              activeActionsDealId === deal.id
                                            ) {
                                              closeRowActions();
                                            } else {
                                              setActiveActionsDealId(deal.id);
                                              setRowActionAnchorEl(
                                                event.currentTarget,
                                              );
                                            }
                                          }}
                                          title={t(
                                            "opportunities.actions.rowMenu",
                                            "Thao tác cơ hội",
                                          )}
                                          aria-label={t(
                                            "opportunities.actions.rowMenu",
                                            "Thao tác cơ hội",
                                          )}
                                          aria-haspopup="menu"
                                          aria-expanded={
                                            activeActionsDealId === deal.id
                                          }
                                        >
                                          <MoreHorizontal
                                            size={14}
                                            className="text-slate-500"
                                          />
                                        </IconButton>
                                      </div>
                                    </div>

                                    {/* Display deal amount & probability */}
                                    <div className="flex md:items-center justify-between gap-2 text-xs">
                                      <span className="block crm-text-wrap text-[11px] font-semibold tabular-nums text-slate-800">
                                        {formatCurrency(deal.amount, deal.currency || "VND", locale)}
                                      </span>
                                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-700">
                                        {deal.opportunityScore}%
                                      </span>
                                    </div>

                                    <DealPipelineHealthBadges
                                      deal={deal}
                                      compact
                                    />

                                    {/* Overdue Badge */}
                                    {dealOverdue && (
                                      <div className="flex min-w-0 items-center gap-1 rounded border border-red-100 bg-red-50 px-2 py-1 text-[9px] font-medium text-red-600">
                                        <AlertTriangle
                                          size={10}
                                          className="shrink-0"
                                        />
                                        <span className="crm-text-wrap">
                                          {t("deals.badges.overdue")}
                                        </span>
                                      </div>
                                    )}

                                    {/* Notes Preview if available */}
                                    {deal.notes && (
                                      <p className="w-full border-l-2 border-indigo-200 pl-1.5 text-left text-[10px] font-normal italic text-slate-500 crm-text-wrap">
                                        {deal.notes}
                                      </p>
                                    )}

                                    {/* Next Activity section */}
                                    {(deal.nextActionAt ||
                                      deal.nextActionSummary) && (
                                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-0.5 min-w-0 text-left">
                                        <p className="block text-[8px] font-medium uppercase leading-3 tracking-wide text-slate-500">
                                          {t("deals.card.nextActivity")}:
                                        </p>
                                        <p
                                          className="crm-text-wrap text-[11px] font-semibold leading-snug text-slate-800"
                                          title={deal.nextActionSummary}
                                        >
                                          {deal.nextActionSummary}
                                        </p>
                                        <p className="text-[8px] font-medium text-amber-700">
                                          {formatDateTime(
                                            deal.nextActionAt,
                                            locale,
                                          )}
                                        </p>
                                      </div>
                                    )}

                                    {/* Risk Indicator fallback if any */}
                                    {deal.riskBadge && !dealOverdue && (
                                      <div className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 text-[9px] font-medium leading-tight min-w-0 justify-start">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                        <span
                                          className="crm-text-wrap"
                                          title={deal.riskBadge}
                                        >
                                          {deal.riskBadge}
                                        </span>
                                      </div>
                                    )}

                                    {/* Owner & Expected Close Date */}
                                    <div className="mt-auto flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] font-medium text-slate-500">
                                      <span className="flex items-center gap-1 min-w-0 flex-1">
                                        <User size={10} className="shrink-0" />
                                        <span
                                          className="crm-text-wrap text-left"
                                          title={ownerLabel}
                                        >
                                          {ownerLabel}
                                        </span>
                                      </span>
                                      <span className="shrink-0 font-sans">
                                        {formatDate(
                                          deal.expectedCloseDate,
                                          locale,
                                        )}
                                      </span>
                                    </div>

                                    {/* Moving stage control stays inside the card at every column width. */}
                                    <div
                                      data-deal-next-stage-action="contained"
                                      className="-mx-4 -mb-4 flex min-w-0 shrink-0 items-center justify-end border-t border-slate-100 bg-slate-50/80 px-4 py-3"
                                    >
                                      {getNextDealStage(deal.stage) && (
                                        <button
                                          type="button"
                                          draggable={false}
                                          data-deal-next-stage-button="contained"
                                          onMouseDown={(e) => e.stopPropagation()}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void advanceDealStage(deal.id);
                                          }}
                                          disabled={isDealAdvancing(deal.id)}
                                          aria-busy={isDealAdvancing(deal.id)}
                                          className="inline-flex h-8 min-w-[76px] max-w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-3 text-[9px] font-semibold leading-none text-indigo-700 shadow-3xs transition-[background-color,border-color,color,box-shadow,opacity] hover:border-indigo-200 hover:bg-indigo-50 hover:shadow-sm disabled:cursor-wait disabled:opacity-65"
                                          title={t("deals.actions.nextStage")}
                                        >
                                          <span className="whitespace-nowrap">{t("deals.actions.next")}</span>
                                          {isDealAdvancing(deal.id) ? <LoaderCircle size={11} className="shrink-0 animate-spin" /> : <ArrowRight size={10} className="shrink-0" />}
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                </React.Fragment>
                              );
                            })}
                          </AnimatePresence>

                          {stageDeals.length === 0 && (
                            <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-sm text-slate-400">
                              {t("deals.empty.noStageDeals")}
                            </div>
                          )}

                          {viewMode === "kanban" && stageWindowQuery.connected && stageWindowQuery.hasMore(stage) && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="mt-1 w-full shrink-0"
                              disabled={stageWindowQuery.isStageLoading(stage)}
                              onClick={() => void stageWindowQuery.loadMore(stage)}
                            >
                              {stageWindowQuery.isStageLoading(stage)
                                ? (locale === "vi" ? "Đang tải…" : "Loading…")
                                : (locale === "vi" ? "Tải thêm cơ hội" : "Load more opportunities")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
        </div>
      ) : (
        /* LIST / TABLE VIEW MODE */
        <>
          {/* Desktop Table Option */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.deal")}
                  </TableCell>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.customer")}
                  </TableCell>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.stage")}
                  </TableCell>
                  <TableCell className="font-extrabold text-right">
                    {t("deals.columns.amount")}
                  </TableCell>
                  <TableCell className="text-center font-extrabold">
                    {t("deals.columns.probability")}
                  </TableCell>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.expectedClose")}
                  </TableCell>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.owner")}
                  </TableCell>
                  <TableCell className="font-extrabold">
                    {t("deals.columns.nextActivity")}
                  </TableCell>
                  <TableCell className="w-12 min-w-12 text-center font-extrabold">
                    {t("deals.columns.actions")}
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeals.map((deal) => {
                  const ownerLabel = resolveWorkspaceMemberLabel(
                    deal.ownerId,
                    locale,
                  );
                  const dealOverdue = isOverdue(
                    deal.expectedCloseDate,
                    deal.stage,
                  );

                  let dealStageVariant:
                    "success" | "warning" | "danger" | "info" | "neutral" =
                    "neutral";
                  const config = stageConfigs.find(
                    (s) => s.code === deal.stage,
                  );
                  if (config) {
                    if (config.category === "won") dealStageVariant = "success";
                    else if (config.category === "lost")
                      dealStageVariant = "danger";
                    else dealStageVariant = "warning";
                  }

                  return (
                    <TableRow
                      key={deal.id}
                      className={`font-medium ${
                        dealOverdue ? "bg-red-50/5" : ""
                      }`}
                    >
                      <TableCell>
                        <span
                          onClick={() =>
                            navigate(`/deals/${deal.id}`, {
                              state: {
                                returnTo: `/deals?view=table`,
                                sourceView: "table",
                              },
                            })
                          }
                          className="font-bold text-indigo-700 hover:underline cursor-pointer block text-xs"
                        >
                          {deal.name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[150px] crm-text-wrap">
                        <div className="font-extrabold text-slate-800 text-[11px]">
                          {deal.customerName}
                        </div>
                        {deal.contactName && (
                          <div className="text-[10px] text-slate-400 font-semibold">
                            {deal.contactName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1.5">
                          <Badge variant={dealStageVariant}>
                            {getDealStageLabel(deal.stage)}
                          </Badge>
                          <DealPipelineHealthBadges deal={deal} compact />
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-slate-800 text-xs shrink-0">
                        {formatCurrency(deal.amount, deal.currency || "VND", locale)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="neutral">
                          {deal.opportunityScore}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`font-semibold text-slate-600 block ${dealOverdue ? "text-red-600" : ""}`}
                        >
                          {formatDate(deal.expectedCloseDate, locale)}
                        </span>
                        {dealOverdue && (
                          <span className="text-[9px] font-extrabold bg-red-100 text-red-700 px-1 py-0.2 rounded mt-0.5 inline-block">
                            {t("deals.badges.overdue")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[9px] font-extrabold text-indigo-700 shrink-0">
                            {ownerLabel.charAt(0)}
                          </div>
                          <span
                            className="font-semibold text-slate-800 crm-text-wrap max-w-[100px]"
                            title={ownerLabel}
                          >
                            {ownerLabel}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 max-w-[180px] crm-text-wrap text-[10px] sm:table-cell">
                        {deal.nextActionAt || deal.nextActionSummary ? (
                          <div className="leading-tight font-semibold text-slate-700">
                            <p className="crm-text-wrap block font-bold text-slate-800">
                              {deal.nextActionSummary}
                            </p>
                            <p className="text-amber-700 font-bold text-[9px] mt-0.5">
                              {formatDateTime(deal.nextActionAt, locale)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">-</span>
                        )}
                      </TableCell>
                      <TableCell className="w-12 min-w-12 text-center">
                        <IconButton
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (activeActionsDealId === deal.id) {
                              closeRowActions();
                            } else {
                              setActiveActionsDealId(deal.id);
                              setRowActionAnchorEl(event.currentTarget);
                            }
                          }}
                          title={t(
                            "opportunities.actions.rowMenu",
                            "Thao tác cơ hội",
                          )}
                          aria-label={t(
                            "opportunities.actions.rowMenu",
                            "Thao tác cơ hội",
                          )}
                          aria-haspopup="menu"
                          aria-expanded={activeActionsDealId === deal.id}
                        >
                          <MoreHorizontal
                            size={14}
                            className="text-slate-500"
                          />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {filteredDeals.length === 0 && (
              <div className="text-center py-16 text-slate-500 space-y-1 bg-white border border-slate-200 rounded-2xl p-6">
                <p className="text-sm font-bold text-slate-600">
                  {t("deals.empty.noDeals")}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {t("deals.empty.noFilterResults")}
                </p>
              </div>
            )}
          </div>

          {/* Mobile Card List fallback */}
          <div className="space-y-3.5 block md:hidden">
            {filteredDeals.map((deal) => {
              const ownerLabel = resolveWorkspaceMemberLabel(
                deal.ownerId,
                locale,
              );
              const dealOverdue = isOverdue(deal.expectedCloseDate, deal.stage);

              let dealStageVariant:
                "success" | "warning" | "danger" | "info" | "neutral" =
                "neutral";
              if (deal.stage === DealStage.WON) dealStageVariant = "success";
              else if (deal.stage === DealStage.LOST)
                dealStageVariant = "danger";
              else if (deal.stage === DealStage.DISCOVERY)
                dealStageVariant = "info";
              else dealStageVariant = "warning";

              return (
                <div
                  key={deal.id}
                  onClick={() =>
                    navigate(`/deals/${deal.id}`, {
                      state: {
                        returnTo: `/deals?view=table`,
                        sourceView: "table",
                      },
                    })
                  }
                  className={`bg-white p-4 rounded-xl border border-slate-200 hover:shadow-xs transition-all text-xs space-y-3 cursor-pointer relative ${
                    dealOverdue ? "border-red-300 bg-red-50/10" : ""
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="space-y-1 min-w-0 flex-1 text-left">
                      <span className="font-extrabold text-indigo-700 hover:underline block text-[13px] leading-tight crm-text-wrap">
                        {deal.name}
                      </span>
                      <p className="text-[11px] text-slate-500 font-semibold crm-text-wrap leading-none">
                        {deal.customerName}
                      </p>
                    </div>
                    <Badge
                      variant={dealStageVariant}
                      className="shrink-0 text-[10px] font-bold py-0.5 px-2"
                    >
                      {getDealStageLabel(deal.stage)}
                    </Badge>
                  </div>

                  <DealPipelineHealthBadges deal={deal} />

                  {/* Pricing Details & Probability */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-left font-medium">
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">
                        {t("deals.columns.amount")}
                      </span>
                      <span className="text-slate-800 font-semibold tabular-nums text-xs block mt-0.5">
                        {formatCurrency(deal.amount, deal.currency || "VND", locale)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] font-bold block uppercase tracking-wider">
                        {t("deals.columns.probability")}
                      </span>
                      <span className="text-slate-700 font-bold block mt-1">
                        {deal.opportunityScore}%
                      </span>
                    </div>
                  </div>

                  {/* Expectation Close date & Owner */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[10px] text-left leading-relaxed">
                    <div>
                      <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">
                        {t("deals.columns.expectedClose")}
                      </span>
                      <span
                        className={`font-semibold block mt-1 ${dealOverdue ? "text-red-600 font-bold" : "text-slate-700"}`}
                      >
                        {formatDate(deal.expectedCloseDate, locale)}
                      </span>
                      {dealOverdue && (
                        <span className="bg-red-100 text-red-700 px-1 py-0.2 rounded font-black text-[8px] mt-0.5 inline-block">
                          {t("deals.badges.overdue")}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 font-bold block uppercase tracking-wider text-[8px]">
                        {t("deals.columns.owner")}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                        <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 text-[8px] font-black text-indigo-700 shrink-0">
                          {ownerLabel.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 crm-text-wrap">
                          {ownerLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="pt-2 border-t border-slate-100 flex justify-end gap-2 items-center">
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/deals/${deal.id}`, {
                          state: {
                            returnTo: `/deals?view=table`,
                            sourceView: "table",
                          },
                        });
                      }}
                      variant="secondary"
                      size="sm"
                      className="text-[10px] py-1 font-bold"
                    >
                      {t("deals.actions.viewDetail")}
                    </Button>

                    {getNextDealStage(deal.stage) && (
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          void advanceDealStage(deal.id);
                        }}
                        disabled={isDealAdvancing(deal.id)}
                        loading={isDealAdvancing(deal.id)}
                        variant="primary"
                        size="sm"
                        className="text-[10px] py-1 font-semibold"
                      >
                        <span>{t("deals.actions.next")}</span>
                        {!isDealAdvancing(deal.id) && <ArrowRight size={10} className="shrink-0" />}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredDeals.length === 0 && (
              <div className="text-center py-16 text-slate-500 space-y-1 bg-white border border-slate-200 rounded-xl p-6">
                <p className="text-sm font-bold text-slate-600">
                  {t("deals.empty.noDeals")}
                </p>
                <p className="text-xs text-slate-400 font-medium">
                  {t("deals.empty.noFilterResults")}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      <RowActionPortal
        open={Boolean(activeActionsDeal && rowActionAnchorEl)}
        anchorEl={rowActionAnchorEl}
        onClose={closeRowActions}
        width={232}
      >
        {activeActionsDeal && (
          <DealActionMenu
            deal={activeActionsDeal}
            onViewDetails={(deal) => {
              closeRowActions();
              navigate(`/deals/${deal.id}`, {
                state: {
                  returnTo: `/deals?view=${viewMode}`,
                  sourceView: viewMode,
                },
              });
            }}
            onEdit={(deal) => {
              closeRowActions();
              handleOpenEditModal(deal);
            }}
            onDuplicate={(deal) => {
              closeRowActions();
              handleDuplicateDeal(deal);
            }}
            onMarkWon={(deal) => {
              closeRowActions();
              handleMarkWonDirect(deal);
            }}
            onMarkLost={(deal) => {
              closeRowActions();
              handleMarkLostDirect(deal);
            }}
            onDelete={(deal) => {
              closeRowActions();
              handleDeleteDeal(deal.id);
            }}
            labels={{
              record: t("opportunities.actions.recordGroup", "Cơ hội"),
              outcome: t("opportunities.actions.outcomeGroup", "Kết quả"),
              danger: t("opportunities.actions.dangerGroup", "Nguy hiểm"),
              viewDetail: t("opportunities.actions.viewDetail"),
              edit: t("opportunities.actions.edit"),
              duplicate: t("opportunities.actions.duplicate"),
              markWon: t("opportunities.actions.markWon"),
              markLost: t("opportunities.actions.markLost"),
              delete: t("opportunities.actions.delete"),
            }}
          />
        )}
      </RowActionPortal>

      <DealPipelineModals controller={controller} />
    </ModulePageShell>
    </AuthoritativeQueryBoundary>
  );
};

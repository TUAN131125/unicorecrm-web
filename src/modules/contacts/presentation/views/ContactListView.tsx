import { AnimatePresence } from "motion/react";
import { User, Sparkles, Trash2, Pencil, Plus, RefreshCw } from "lucide-react";
import { Button, ConfirmDialog, IconButton, Modal } from "@/shared/components/ui";
import { PageHeaderActions } from "@/components/crm/PageHeaderActions";
import { SavedViewNameModal } from "@/components/crm/SavedViewNameModal";
import { ListPageFrame, ListPageHeader, ListPaginationBar, ListStatePanel, ListToolbar, useListPagination } from "@/components/crm/list-archetype";
import { ContactStatisticsPanel } from "../list/ContactStatisticsPanel";
import { ContactTable } from "../list/ContactTable";
import { ContactCardList } from "../list/ContactCardList";
import { ContactCreateModal } from "../list/ContactCreateModal";
import { ContactOpportunityModal } from "../list/ContactOpportunityModal";

// Advanced list controls
import { CONTACT_COLUMNS_METADATA } from "../model/contactColumns";
import { ContactSavedViewSelector } from "../list/ContactSavedViewSelector";
import { ContactColumnSettingsDrawer } from "../list/ContactColumnSettingsDrawer";
import { ContactFilterPopover } from "../list/ContactFilterPopover";
import { ContactBulkChangeOwnerModal } from "../list/ContactBulkChangeOwnerModal";
import { ContactTopActionMenu } from "../list/ContactTopActionMenu";
import type { useContactListController } from "../hooks/useContactListController";

type ContactListViewController = ReturnType<typeof useContactListController>;

export function ContactListView({ controller }: { controller: ContactListViewController }) {
  const {
    canCreateContact,
    canUpdateContact,
    canArchiveContact,
    contactOpportunityAvailable,
    customers,
    deals,
    setDeals,
    crmConfig,
    t,
    tx,
    locale,
    navigate,
    contacts,
    setContacts,
    productCatalog,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    linkFilter,
    setLinkFilter,
    sourceFilter,
    setSourceFilter,
    ownerFilter,
    setOwnerFilter,
    priorityFilter,
    setPriorityFilter,
    sortBy,
    setSortBy,
    relationshipLevelFilter,
    setRelationshipLevelFilter,
    decisionRoleFilter,
    setDecisionRoleFilter,
    nextFollowUpAtFilter,
    setNextFollowUpAtFilter,
    lastInteractionAtFilter,
    setLastInteractionAtFilter,
    doNotContactFilter,
    setDoNotContactFilter,
    hasActiveFilters,
    activeFiltersCount,
    resetFilters,
    activeView,
    selectSavedView,
    isViewDropdownOpen,
    setIsViewDropdownOpen,
    customViews,
    isHeaderMoreOpen,
    setIsHeaderMoreOpen,
    isColumnSettingsOpen,
    setIsColumnSettingsOpen,
    visibleColumns,
    columnWidths,
    createCustomView,
    updateCustomView,
    deleteCustomView,
    saveColumnSettings,
    resetColumnSettings,
    resizeColumn,
    resetColumnWidth,
    viewMode,
    setViewMode,
    showStatisticsPanel,
    setShowStatisticsPanel,
    isFilterOpen,
    setIsFilterOpen,
    savedViewDialog,
    setSavedViewDialog,
    viewName,
    setViewName,
    viewNameError,
    setViewNameError,
    isSavingView,
    setIsSavingView,
    viewSaveInFlightRef,
    viewToDelete,
    setViewToDelete,
    selectedContactIds,
    setSelectedContactIds,
    openRowActionId,
    setOpenRowActionId,
    showBulkReassignModal,
    setShowBulkReassignModal,
    getCurrentViewSnapshot,
    applySavedPresentationState,
    getActiveCustomView,
    handleSelectSavedView,
    closeSavedViewDialog,
    handleAddViewClick,
    handleEditViewClick,
    handleSubmitSavedView,
    handleDeleteCustomView,
    handleResetFilters,
    handleSaveColumnSettings,
    handleResetColumnSettings,
    handleColumnResize,
    handleColumnReset,
    handleSelectRow,
    handleSelectAll,
    handleBulkChangeOwner,
    handleBulkChangeStatus,
    confirmModal,
    isConfirming,
    setConfirmModal,
    promptModal,
    setPromptModal,
    requestConfirmation,
    requestPrompt,
    handleBulkDelete,
    handleBulkArchive,
    handleBulkAddTags,
    handleBulkDoNotContact,
    activeMenuContactId,
    setActiveMenuContactId,
    toastMessage,
    setToastMessage,
    dropdownRef,
    showAddForm,
    setShowAddForm,
    isHeaderMenuOpen,
    setIsHeaderMenuOpen,
    selectedContactForDeal,
    setSelectedContactForDeal,
    showToast,
    handleSaveContact,
    handleCall,
    handleEmail,
    handleCommitOpportunity,
    handleArchiveContact,
    handleBulkExport,
    handleDownloadTemplate,
    filteredContacts,
    sortedContacts,
    statsSummary,
  } = controller;

  const pagination = useListPagination(sortedContacts, 25);
  const handleSelectCurrentPage = (checked: boolean) => {
    const pageIds = pagination.pageItems.map((contact) => contact.id);
    setSelectedContactIds((current) => checked
      ? Array.from(new Set([...current, ...pageIds]))
      : current.filter((id) => !pageIds.includes(id)));
  };

  return (
    <ListPageFrame id="contact-workspace" className="text-slate-700">

      {/* Page Header */}
      <ListPageHeader
        title={t("contactList.title")}
        count={sortedContacts.length}
        context={locale === "vi" ? "Relationship records" : "Relationship records"}
        icon={<User size={18} />}
        actions={
          <PageHeaderActions
            actions={[
              {
                id: "import-contact",
                label: t("contactList.actions.import"),
                onClick: () => showToast(t("common.comingSoon")),
                variant: "secondary",
                hidden: !canCreateContact,
              },
              {
                id: "add-contact",
                label: t("contactList.actions.addContact"),
                icon: <Plus size={14} />,
                onClick: () => setShowAddForm(true),
                variant: "primary",
                hidden: !canCreateContact,
              },
            ]}
            moreActions={
              <ContactTopActionMenu
                selectedCount={selectedContactIds.length}
                writesAvailable={false}
                importsAvailable={false}
                onExportAll={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(contacts, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `UnicoreCRM-All-Contacts-Export-${new Date().toISOString().substring(0, 10)}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                  showToast(tx("contactList.toastMessage.exportedAll", "Đã xuất dữ liệu toàn bộ thành công!"));
                }}
                onPrintList={() => {
                  window.print();
                }}
                onManageSharing={() => {
                  showToast(tx("contactList.toastMessage.sharingInit", "Đang mở bảng quản lý phân quyền chia sẻ..."));
                }}
                onManageTags={() => {
                  showToast(tx("contactList.toastMessage.tagsInit", "Tính năng quản lý danh mục thẻ đang khởi tạo!"));
                }}
                onDownloadImportTemplate={handleDownloadTemplate}
                onAdvancedImport={() => {
                  showToast(tx("contactList.toastMessage.importInit", "Tính năng nhập liệu đang được khởi tạo!"));
                }}
              />
            }
          />
        }
      />

      {/* Modern Toolbar incorporating saved views and advanced filters toggling */}
      <ListToolbar
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder={tx("contactList.filters.searchPlaceholder", "Tìm theo tên, mã KH, ĐT...")}
        viewMode={viewMode}
        onViewModeChange={(val) => setViewMode(val as "table" | "card")}
        viewOptions={[
          { value: "table" as const, label: tx("contactList.view.table", "Table view") },
          { value: "card" as const, label: tx("contactList.view.grid", "Card view") }
        ]}
        showFilters={true}
        onOpenFilters={() => setIsFilterOpen((open) => !open)}
        onCloseFilters={() => setIsFilterOpen(false)}
        filtersOpen={isFilterOpen}
        filtersPanel={(
          <ContactFilterPopover
            isOpen={isFilterOpen}
            onClose={() => setIsFilterOpen(false)}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            ownerFilter={ownerFilter}
            setOwnerFilter={setOwnerFilter}
            sourceFilter={sourceFilter}
            setSourceFilter={setSourceFilter}
            linkFilter={linkFilter}
            setLinkFilter={setLinkFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            relationshipLevelFilter={relationshipLevelFilter}
            setRelationshipLevelFilter={setRelationshipLevelFilter}
            decisionRoleFilter={decisionRoleFilter}
            setDecisionRoleFilter={setDecisionRoleFilter}
            nextFollowUpAtFilter={nextFollowUpAtFilter}
            setNextFollowUpAtFilter={setNextFollowUpAtFilter}
            lastInteractionAtFilter={lastInteractionAtFilter}
            setLastInteractionAtFilter={setLastInteractionAtFilter}
            doNotContactFilter={doNotContactFilter}
            setDoNotContactFilter={setDoNotContactFilter}
            onResetAll={handleResetFilters}
          />
        )}
        showColumns={true}
        onOpenColumns={() => setIsColumnSettingsOpen(true)}
        showStats={true}
        onOpenStats={() => setShowStatisticsPanel(true)}
        activeFilterCount={activeFiltersCount}
        hasActiveFilters={hasActiveFilters}
        filtersLabel={tx("contactList.filters.filter", "Bộ lọc")}
        columnsLabel={tx("contactList.columnDisplaySettings", "Cột")}
        statsLabel={t("common.statistics")}
        leftSlot={
          <div className="flex items-center gap-2 shrink-0">
            <ContactSavedViewSelector
              customViews={customViews}
              activeView={activeView}
              setActiveView={handleSelectSavedView}
              isViewDropdownOpen={isViewDropdownOpen}
              setIsViewDropdownOpen={setIsViewDropdownOpen}
              contactsCount={sortedContacts.length}
              onAddViewClick={handleAddViewClick}
            />
            {getActiveCustomView() && (() => {
              const activeCustomView = getActiveCustomView();
              const viewLabel = activeCustomView?.labelKey || "";
              return (
                <>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEditViewClick}
                    className="h-8 w-8 rounded-xl text-slate-500 hover:text-indigo-600"
                    title={tx("contactList.customViews.editTooltip", "S\u1eeda giao di\u1ec7n " + viewLabel, { name: viewLabel })}
                    aria-label={"S\u1eeda giao di\u1ec7n " + viewLabel}
                  >
                    <Pencil size={14} />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewToDelete(activeView)}
                    className="h-8 w-8 rounded-xl text-slate-500 hover:text-red-600"
                    title={tx("contactList.customViews.deleteTooltip", "X\u00f3a giao di\u1ec7n " + viewLabel, { name: viewLabel })}
                    aria-label={"X\u00f3a giao di\u1ec7n " + viewLabel}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </>
              );
            })()}
          </div>
        }
        rightSlot={
          <button
            type="button"
            onClick={() => {
              showToast(tx("contactList.toastMessage.refreshed", "Đã làm mới dữ liệu"));
            }}
            className="p-2.5 text-slate-600 hover:text-violet-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-xs transition-all flex items-center justify-center h-10 w-10 cursor-pointer"
            title={tx("contactList.toolbar.refresh", "Làm mới")}
          >
            <RefreshCw size={14} />
          </button>
        }
      />

      {/* Saved view create/update modal */}
      <SavedViewNameModal
        isOpen={savedViewDialog !== null}
        onClose={closeSavedViewDialog}
        mode={savedViewDialog?.mode ?? "create"}
        name={viewName}
        onNameChange={(name) => { setViewName(name); if (viewNameError) setViewNameError(""); }}
        onSubmit={handleSubmitSavedView}
        error={viewNameError || undefined}
        loading={isSavingView}
        formId="contact-saved-view-form"
      />

      <ConfirmDialog
        isOpen={!!viewToDelete}
        onClose={() => setViewToDelete(null)}
        onConfirm={handleDeleteCustomView}
        title={tx("contactList.customViews.deleteTitle", "X\u00f3a giao di\u1ec7n?")}
        description={tx("contactList.customViews.deleteDescription", "Giao di\u1ec7n \u0111\u00e3 l\u01b0u s\u1ebd b\u1ecb x\u00f3a v\u00e0 danh s\u00e1ch s\u1ebd tr\u1edf v\u1ec1 c\u1ea5u h\u00ecnh m\u1eb7c \u0111\u1ecbnh.")}
        confirmText={tx("contactList.customViews.deleteAction", "X\u00f3a giao di\u1ec7n")}
        cancelText={tx("common.cancel", "Hủy")}
        type="danger"
      />

      {/* Contacts Interactive Lists and Tables representation */}
      {sortedContacts.length === 0 ? (
        <ListStatePanel
          kind="empty"
          title={locale === "vi" ? "Không có Contact phù hợp" : "No matching contacts"}
          action={canCreateContact ? <button type="button" onClick={() => setShowAddForm(true)} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700">{t("contactList.actions.addContact")}</button> : undefined}
        />
      ) : (
        <>
      <div className={viewMode === "card" ? "block" : "block md:hidden"}>
        <ContactCardList
          filteredContacts={pagination.pageItems}
          selectedContactIds={selectedContactIds}
          onSelectRow={handleSelectRow}
          openRowActionId={openRowActionId}
          setOpenRowActionId={setOpenRowActionId}
          onCall={handleCall}
          onEmail={handleEmail}
          onOpenOpportunityWizard={contactOpportunityAvailable ? (c) => setSelectedContactForDeal(c) : undefined}
          onOpenDeleteConfirm={canArchiveContact ? handleArchiveContact : undefined}
          onViewDetails={(contactId) => navigate(`/contacts/${contactId}`)}
        />
      </div>

      <div className={viewMode === "table" ? "hidden md:block" : "hidden"}>
        <ContactTable
          contacts={pagination.pageItems}
            visibleColumns={visibleColumns}
          columnWidths={columnWidths}
          selectedContactIds={selectedContactIds}
          onSelectAll={handleSelectCurrentPage}
          onSelectRow={handleSelectRow}
          onColumnResize={handleColumnResize}
          onColumnReset={handleColumnReset}
          openRowActionId={openRowActionId}
          setOpenRowActionId={setOpenRowActionId}
          onCall={handleCall}
          onEmail={handleEmail}
          onOpenOpportunityWizard={contactOpportunityAvailable ? (c) => setSelectedContactForDeal(c) : undefined}
          onOpenDeleteConfirm={canArchiveContact ? handleArchiveContact : undefined}
          onViewDetails={(contactId) => navigate(`/contacts/${contactId}`)}
        />
      </div>
      <ListPaginationBar {...pagination} itemLabelVi="người liên hệ" itemLabelEn="contacts" />
        </>
      )}

      {/* Advanced Custom Drawer Components integration */}
      <ContactColumnSettingsDrawer
        isOpen={isColumnSettingsOpen}
        onClose={() => setIsColumnSettingsOpen(false)}
        allFields={CONTACT_COLUMNS_METADATA.map(c => c.key)}
        visibleColumns={visibleColumns}
        onSave={handleSaveColumnSettings}
        onResetDefault={handleResetColumnSettings}
      />


      {canUpdateContact && <ContactBulkChangeOwnerModal
        show={showBulkReassignModal}
        onClose={() => setShowBulkReassignModal(false)}
        selectedCount={selectedContactIds.length}
        onConfirm={handleBulkChangeOwner}
      />}

      {/* G. WIZARD MODAL 1: GENERATE SALES OPPORTUNITY */}
      {contactOpportunityAvailable && <ContactOpportunityModal
        contact={selectedContactForDeal}
        onClose={() => setSelectedContactForDeal(null)}
        onConfirm={handleCommitOpportunity}
      />}

      {/* C. Slide-out New Contact Create Modal */}
      {canCreateContact && <ContactCreateModal
        show={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSave={handleSaveContact}
      />}

      {/* Contact Statistics Panel (Side Drawer / Aesthetic Panel) */}
      <ContactStatisticsPanel
        show={showStatisticsPanel}
        onClose={() => setShowStatisticsPanel(false)}
        statsSummary={statsSummary}
      />

      {/* Styled toast overlay */}
      <AnimatePresence>
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl animate-fade-in text-slate-700 font-sans">
            <Sparkles size={14} className="text-indigo-600 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Dialog */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => { if (!isConfirming) setConfirmModal((prev) => ({ ...prev, isOpen: false })); }}
        title={confirmModal.title}
        size="sm"
      >
        <div className="space-y-4 text-slate-700 text-sm py-2 text-left font-sans">
          <p className="text-slate-600 font-medium leading-relaxed">{confirmModal.message}</p>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
              disabled={isConfirming}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              className="bg-indigo-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-xs transition-all"
              onClick={confirmModal.onConfirm}
              disabled={isConfirming}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </Modal>

      {/* Custom Prompt Dialog */}
      <Modal variant="form"
        isOpen={promptModal.isOpen}
        onClose={() => setPromptModal((prev) => ({ ...prev, isOpen: false }))}
        title={promptModal.title}
        size="sm"
      >
        <div className="space-y-4 text-slate-700 text-sm py-2 text-left font-sans">
          <p className="text-slate-600 font-medium leading-relaxed">{promptModal.message}</p>
          <input
            type="text"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={promptModal.value}
            onChange={(e) => setPromptModal((prev) => ({ ...prev, value: e.target.value }))}
            placeholder="..."
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setPromptModal((prev) => ({ ...prev, isOpen: false }))}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              className="bg-indigo-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-indigo-700 text-xs transition-all"
              onClick={() => promptModal.onConfirm(promptModal.value)}
            >
              Xác nhận
            </Button>
          </div>
        </div>
      </Modal>

    </ListPageFrame>
  );

}

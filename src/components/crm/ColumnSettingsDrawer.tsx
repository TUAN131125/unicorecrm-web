import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Search, GripVertical, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button, Checkbox } from "@/shared/components/ui";
import { useI18n } from "../../i18n";
import { useBodyScrollLock } from "@/shared/hooks/useBodyScrollLock";
import { OVERLAY_Z } from "../overlay/overlayLayers";

interface ColumnSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  allFields: string[];
  visibleColumns: string[];
  onSave: (columns: any[]) => void;
  onResetDefault: () => void;
  translationPrefix?: string;
  defaultTitle?: string;
  defaultSearchPlaceholder?: string;
  defaultSelectedCountLabel?: string;
  defaultClearAllLabel?: string;
  defaultDragToReorderLabel?: string;
  defaultUnselectedLabel?: string;
  defaultSaveLabel?: string;
  getFieldLabel?: (fieldKey: string) => string;
}

export const ColumnSettingsDrawer: React.FC<ColumnSettingsDrawerProps> = ({
  isOpen,
  onClose,
  allFields,
  visibleColumns,
  onSave,
  onResetDefault,
  translationPrefix = "leads",
  defaultTitle,
  defaultSearchPlaceholder,
  defaultSelectedCountLabel,
  defaultClearAllLabel,
  defaultDragToReorderLabel,
  defaultUnselectedLabel,
  defaultSaveLabel,
  getFieldLabel
}) => {
  const { t, tx, locale } = useI18n();

  useBodyScrollLock(isOpen);

  // Robust case-insensitive and case-fallback translation retriever
  const getTranslation = (keySuffix: string, params?: any, fallback?: string): string => {
    if (!translationPrefix) return fallback || keySuffix;

    const lowerKey = `${translationPrefix.toLowerCase()}.${keySuffix}`;
    const valLower = t(lowerKey, params);
    if (valLower !== lowerKey) return valLower;

    const directKey = `${translationPrefix}.${keySuffix}`;
    const valDirect = t(directKey, params);
    if (valDirect !== directKey) return valDirect;

    return fallback || keySuffix;
  };

  // Temporary columns state for the drawer
  const [tempColumns, setTempColumns] = useState<any[]>([]);
  const [colSearchQuery, setColSearchQuery] = useState("");

  // Sync state when open
  useEffect(() => {
    if (isOpen) {
      setTempColumns([...visibleColumns]);
    }
  }, [isOpen, visibleColumns]);

  // Drag-and-drop states
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleColumnDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    const list = [...tempColumns];
    const draggedItem = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(targetIndex, 0, draggedItem);
    setTempColumns(list);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleApply = () => {
    onSave(tempColumns);
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop wrapper */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm cursor-pointer ${OVERLAY_Z.drawerBackdrop}`}
            onClick={onClose}
            id="crm-column-settings-backdrop"
          />
          
          {/* Drawer container body */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col outline-none border-l border-slate-100 font-sans ${OVERLAY_Z.drawer}`}
            id="crm-column-settings-drawer"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                <Settings size={14} className="text-indigo-600" />
                <span>{defaultTitle || getTranslation("columnSettings.title", undefined, locale === "vi" ? "Tùy chỉnh cột" : "Customize Columns")}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onResetDefault();
                  // Reset immediately in state too
                  onClose();
                }}
                className="text-[10px] text-cyan-600 hover:underline font-extrabold cursor-pointer"
              >
                {getTranslation("columnSettings.btnDefault", undefined, locale === "vi" ? "Mặc định" : "Default")}
              </button>
            </div>

            {/* Content box */}
            <div className="flex-1 overflow-hidden flex flex-row">
              
              {/* Left Panel: Available checklist fields */}
              <div className="w-1/2 border-r border-slate-100 flex flex-col p-3.5 space-y-3 bg-slate-50/50">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                  <input
                    type="text"
                    placeholder={defaultSearchPlaceholder || getTranslation("columnSettings.searchPlaceholder", undefined, locale === "vi" ? "Tìm kiếm cột..." : "Search columns...")}
                    value={colSearchQuery}
                    onChange={(e) => setColSearchQuery(e.target.value)}
                    className="text-[10px] pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg placeholder-slate-400 text-slate-700 focus:outline-none w-full font-semibold focus:border-indigo-500"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 text-left">
                  {allFields
                    .filter(key => {
                      const label = getFieldLabel?.(key) || getTranslation(`columnSettings.fields.${key}`, undefined, key);
                      return label.toLowerCase().includes(colSearchQuery.toLowerCase());
                    })
                    .map((colKey) => {
                      const isSelected = tempColumns.includes(colKey);
                      const keyLabel = getFieldLabel?.(colKey) || getTranslation(`columnSettings.fields.${colKey}`, undefined, colKey);
                      return (
                        <div
                          key={colKey}
                          className={`p-1.5 rounded-lg transition-all select-none ${
                            isSelected ? "bg-indigo-50" : "hover:bg-slate-100"
                          }`}
                        >
                          <Checkbox
                            id={`col-cfg-${colKey}`}
                            checked={isSelected}
                            label={<span className={`crm-text-wrap text-[10px] font-extrabold ${isSelected ? "text-indigo-800" : "text-slate-600"}`}>{keyLabel}</span>}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTempColumns([...tempColumns, colKey]);
                              } else {
                                setTempColumns(tempColumns.filter(c => c !== colKey));
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Panel: Reorder & Drag items */}
              <div className="w-1/2 flex flex-col p-3.5 space-y-3 bg-white">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                  <span>{defaultSelectedCountLabel || getTranslation("columnSettings.selectedCount", { count: tempColumns.length }, locale === "vi" ? `Đã chọn (${tempColumns.length})` : `Selected (${tempColumns.length})`)}</span>
                  <button
                    onClick={() => setTempColumns([])}
                    className="text-red-500 hover:underline cursor-pointer"
                  >
                    {defaultClearAllLabel || getTranslation("columnSettings.clearAll", undefined, locale === "vi" ? "Xóa tất cả" : "Clear all")}
                  </button>
                </div>

                {tempColumns.length > 0 && (
                  <div className="text-[9px] text-indigo-500 font-semibold px-1.5 py-1 bg-indigo-50/50 rounded-md border border-indigo-100 flex items-center gap-1 select-none">
                    <GripVertical size={10} className="text-indigo-400 shrink-0" />
                    <span>{defaultDragToReorderLabel || getTranslation("columnSettings.dragToReorder", undefined, locale === "vi" ? "Kéo thả để sắp xếp" : "Drag and drop to reorder")}</span>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-1">
                  {tempColumns.map((colKey, index) => {
                    const keyLabel = getFieldLabel?.(colKey) || getTranslation(`columnSettings.fields.${colKey}`, undefined, colKey);
                    return (
                      <div
                        key={colKey}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleColumnDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center justify-between p-2 rounded-lg text-[10px] font-bold transition-all border ${
                          draggedIndex === index
                            ? "opacity-50 border-indigo-300 bg-indigo-50/50"
                            : dragOverIndex === index
                            ? "border-dashed border-indigo-400 bg-indigo-50/20 shadow-inner scale-95"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 cursor-grab active:cursor-grabbing select-none">
                          <GripVertical size={12} className="text-slate-400 shrink-0" />
                          <span className="crm-text-wrap pr-1">{keyLabel}</span>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Move up button */}
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              const updated = [...tempColumns];
                              const temp = updated[index];
                              updated[index] = updated[index - 1];
                              updated[index - 1] = temp;
                              setTempColumns(updated);
                            }}
                            aria-label={locale === "vi" ? `Di chuyển ${keyLabel} lên` : `Move ${keyLabel} up`}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp size={12} aria-hidden="true" />
                          </button>
                          {/* Move down button */}
                          <button
                            type="button"
                            disabled={index === tempColumns.length - 1}
                            onClick={() => {
                              const updated = [...tempColumns];
                              const temp = updated[index];
                              updated[index] = updated[index + 1];
                              updated[index + 1] = temp;
                              setTempColumns(updated);
                            }}
                            aria-label={locale === "vi" ? `Di chuyển ${keyLabel} xuống` : `Move ${keyLabel} down`}
                            className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown size={12} aria-hidden="true" />
                          </button>
                          {/* Remove button */}
                          <button
                            type="button"
                            onClick={() => setTempColumns(tempColumns.filter(c => c !== colKey))}
                            aria-label={locale === "vi" ? `Gỡ cột ${keyLabel}` : `Remove ${keyLabel} column`}
                            className="text-slate-400 hover:text-red-500 rounded p-0.5 ml-1 cursor-pointer"
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {tempColumns.length === 0 && (
                    <div className="text-center py-10 text-slate-300 text-[10px] font-bold">
                      {defaultUnselectedLabel || tx("common.noColumnsSelected", locale === "vi" ? "Chưa chọn cột hiển thị" : "No display columns selected")}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Footer buttons */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
              <Button variant="secondary" onClick={onClose}>
                {t("common.cancel", "Hủy")}
              </Button>
              <Button variant="primary" onClick={handleApply}>
                {defaultSaveLabel || getTranslation("columnSettings.save", undefined, t("common.save", "Save changes"))}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

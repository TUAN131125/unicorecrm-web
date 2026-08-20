import React from "react";
import type { Locale } from "./types";
import { hasLegacyUiCopy, resolveLegacyUiCopy } from "./legacyUiCopy";

const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();

function isSkipped(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  if (!element) return false;
  if (SKIP_TAGS.has(element.tagName)) return true;
  return Boolean(element.closest("[data-i18n-skip='true'], [contenteditable='true']"));
}

function translateTextNode(node: Text, locale: Locale): void {
  if (isSkipped(node)) return;
  const current = node.nodeValue ?? "";
  const remembered = originalText.get(node);
  const source = remembered ?? current;
  if (!hasLegacyUiCopy(source)) return;
  if (!remembered) originalText.set(node, source);
  const next = resolveLegacyUiCopy(source, locale);
  if (current !== next) node.nodeValue = next;
}

function translateAttributes(element: Element, locale: Locale): void {
  if (isSkipped(element)) return;
  let stored = originalAttributes.get(element);
  for (const attribute of TRANSLATABLE_ATTRIBUTES) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const remembered = stored?.get(attribute);
    const source = remembered ?? current;
    if (!hasLegacyUiCopy(source)) continue;
    if (!stored) {
      stored = new Map<string, string>();
      originalAttributes.set(element, stored);
    }
    if (!remembered) stored.set(attribute, source);
    const next = resolveLegacyUiCopy(source, locale);
    if (current !== next) element.setAttribute(attribute, next);
  }
}

function translateTree(root: Node, locale: Locale): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, locale);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root as Element, locale);
  const walker = document.createTreeWalker(root, 1 | 4);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) translateTextNode(current as Text, locale);
    else if (current.nodeType === Node.ELEMENT_NODE) translateAttributes(current as Element, locale);
    current = walker.nextNode();
  }
}

/**
 * Temporary compatibility bridge for legacy UI literals. It translates only
 * exact, audited source literals and never translates input values or record
 * data. New code should use useI18n().t/tx directly.
 */
export const LegacyUiTranslationBridge: React.FC<{ locale: Locale }> = ({ locale }) => {
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale === "vi" ? "vi" : "en";
    let applying = false;
    const apply = (root: Node) => {
      if (applying) return;
      applying = true;
      try {
        translateTree(root, locale);
      } finally {
        applying = false;
      }
    };

    apply(document.body);
    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          apply(mutation.target);
          continue;
        }
        if (mutation.type === "attributes" && mutation.target instanceof Element) {
          apply(mutation.target);
          continue;
        }
        mutation.addedNodes.forEach(apply);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
};

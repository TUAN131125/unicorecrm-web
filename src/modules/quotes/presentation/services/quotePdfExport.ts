import { createDurableId } from "@/shared/ids";
export interface QuotePdfResult {
  blob: Blob;
  fileName: string;
}

const COLOR_STYLE_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "fill",
  "stroke",
] as const;

const COMPOSITE_COLOR_PROPERTIES = ["boxShadow", "textShadow", "backgroundImage", "filter"] as const;

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));

function parseCssNumber(value: string, percentageScale = 1): number {
  const token = value.trim();
  if (token.toLowerCase() === "none") return 0;
  if (token.endsWith("%")) return (Number.parseFloat(token) / 100) * percentageScale;
  return Number.parseFloat(token);
}

function parseHue(value: string): number {
  const token = value.trim().toLowerCase();
  if (token === "none") return 0;
  if (token.endsWith("rad")) return Number.parseFloat(token) * 180 / Math.PI;
  if (token.endsWith("turn")) return Number.parseFloat(token) * 360;
  if (token.endsWith("grad")) return Number.parseFloat(token) * 0.9;
  return Number.parseFloat(token);
}

function linearToSrgb(value: number): number {
  const converted = value <= 0.0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
  return Math.round(clamp(converted) * 255);
}

function oklabToRgb(lValue: number, aValue: number, bValue: number, alpha = 1): string {
  const lPrime = lValue + 0.3963377774 * aValue + 0.2158037573 * bValue;
  const mPrime = lValue - 0.1055613458 * aValue - 0.0638541728 * bValue;
  const sPrime = lValue - 0.0894841775 * aValue - 1.291485548 * bValue;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const red = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return alpha < 1 ? `rgba(${red}, ${green}, ${blue}, ${clamp(alpha)})` : `rgb(${red}, ${green}, ${blue})`;
}

function convertOklch(value: string): string | null {
  const [coordinates, alphaToken] = value.split(/\s*\/\s*/);
  const [lightnessToken, chromaToken, hueToken] = coordinates.trim().split(/\s+/);
  if (!lightnessToken || !chromaToken || !hueToken) return null;
  const lightness = parseCssNumber(lightnessToken);
  const chroma = parseCssNumber(chromaToken);
  const hueRadians = parseHue(hueToken) * Math.PI / 180;
  const alpha = alphaToken ? parseCssNumber(alphaToken) : 1;
  if (![lightness, chroma, hueRadians, alpha].every(Number.isFinite)) return null;
  return oklabToRgb(lightness, chroma * Math.cos(hueRadians), chroma * Math.sin(hueRadians), alpha);
}

function convertOklab(value: string): string | null {
  const [coordinates, alphaToken] = value.split(/\s*\/\s*/);
  const [lightnessToken, aToken, bToken] = coordinates.trim().split(/\s+/);
  if (!lightnessToken || !aToken || !bToken) return null;
  const lightness = parseCssNumber(lightnessToken);
  const aValue = parseCssNumber(aToken, 0.4);
  const bValue = parseCssNumber(bToken, 0.4);
  const alpha = alphaToken ? parseCssNumber(alphaToken) : 1;
  if (![lightness, aValue, bValue, alpha].every(Number.isFinite)) return null;
  return oklabToRgb(lightness, aValue, bValue, alpha);
}

export function normalizePdfColorValue(value: string): string {
  return value
    .replace(/oklch\(([^)]*)\)/gi, (match, body: string) => convertOklch(body) ?? match)
    .replace(/oklab\(([^)]*)\)/gi, (match, body: string) => convertOklab(body) ?? match);
}

function cssPropertyName(property: string): string {
  return property.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function applyPdfSafeComputedColors(source: HTMLElement, clone: HTMLElement): void {
  const sourceNodes = [source, ...Array.from(source.querySelectorAll<HTMLElement>("*"))];
  const cloneNodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
  for (let index = 0; index < Math.min(sourceNodes.length, cloneNodes.length); index += 1) {
    const sourceNode = sourceNodes[index];
    const cloneNode = cloneNodes[index];
    const computed = window.getComputedStyle(sourceNode);
    for (const property of COLOR_STYLE_PROPERTIES) {
      const value = normalizePdfColorValue(computed[property]);
      if (!value) continue;
      const safeValue = /oklch|oklab|color-mix/i.test(value)
        ? (property === "color" ? "rgb(15, 23, 42)" : "transparent")
        : value;
      cloneNode.style.setProperty(cssPropertyName(property), safeValue, "important");
    }
    for (const property of COMPOSITE_COLOR_PROPERTIES) {
      const value = normalizePdfColorValue(computed[property]);
      if (!value) continue;
      cloneNode.style.setProperty(
        cssPropertyName(property),
        /oklch|oklab|color-mix/i.test(value) ? "none" : value,
        "important",
      );
    }
    cloneNode.style.setProperty("color-scheme", "light", "important");
  }
}

export async function createQuotePdfFromElement(element: HTMLElement, fileName: string): Promise<QuotePdfResult> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const exportId = createDurableId("quote-pdf");
  element.setAttribute("data-quote-pdf-export-id", exportId);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: Math.max(element.scrollWidth, element.clientWidth),
      onclone: (clonedDocument) => {
        const clonedElement = clonedDocument.querySelector<HTMLElement>(`[data-quote-pdf-export-id="${exportId}"]`);
        if (!clonedElement) throw new Error("Quote PDF clone is unavailable.");
        applyPdfSafeComputedColors(element, clonedElement);
      },
    });
  } finally {
    element.removeAttribute("data-quote-pdf-export-id");
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;
  const renderedHeight = (canvas.height * usableWidth) / canvas.width;
  const image = canvas.toDataURL("image/jpeg", 0.94);

  let offsetY = 0;
  let pageIndex = 0;
  while (offsetY < renderedHeight || pageIndex === 0) {
    if (pageIndex > 0) pdf.addPage();
    pdf.addImage(image, "JPEG", margin, margin - offsetY, usableWidth, renderedHeight, undefined, "FAST");
    offsetY += pageHeight - margin * 2;
    pageIndex += 1;
  }

  return { blob: pdf.output("blob"), fileName };
}

export function downloadQuotePdf(result: QuotePdfResult): void {
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

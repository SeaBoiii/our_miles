import codes from "./merchant-data/mcc-codes.json";
import sources from "./merchant-data/sources.json";

export interface MccReference { code: string; description: string; }

/** Descriptions only. A code's presence never makes it reward-eligible. */
export const MCC_REFERENCE: MccReference[] = codes.map(([code,description])=>({code,description}));
export const MCC_REFERENCE_SOURCE = {url:"https://github.com/greggles/mcc-codes",license:"Unlicense",revision:sources.codes.revision,lastRetrievedAt:sources.retrievedAt,manualUrl:"https://usa.visa.com/content/dam/VCOM/download/merchants/visa-merchant-data-standards-manual.pdf",note:"Public USDA/IRS-derived reference; may include historical codes. The current network manual and posted transaction decide classification."};

export function getMccDescription(value: number | string): string | undefined {
  const code = String(value).padStart(4,"0");
  return MCC_REFERENCE.find(entry=>entry.code === code)?.description;
}

export function searchMccCodes(query: string, limit = 10): MccReference[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return MCC_REFERENCE.filter(entry=>entry.code.includes(needle) || entry.description.toLowerCase().includes(needle)).sort((a,b)=>Number(b.code === needle)-Number(a.code === needle) || a.code.localeCompare(b.code)).slice(0,Math.max(0,limit));
}

/** Optional, reviewed build-time refresh. The application never calls these providers. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const referenceDir = path.join(root, "src", "lib", "merchant-data");
const licenseDir = path.join(root, "docs", "licenses");
const retrievedAt = new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Singapore",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Public data fetch failed: ${response.status} ${url}`);
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("Unexpectedly large public dataset");
  return text;
}

async function revision(repo) {
  const result = JSON.parse(await fetchText(`https://api.github.com/repos/${repo}/commits/main`));
  if (!/^[a-f0-9]{40}$/.test(result.sha)) throw new Error("Invalid source revision");
  return result.sha;
}

function parseCsv(input) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (character === '"') {
      if (quoted && input[index + 1] === '"') { field += '"'; index++; }
      else quoted = !quoted;
    } else if (!quoted && character === ",") { row.push(field); field = ""; }
    else if (!quoted && character === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (field || row.length) {row.push(field.replace(/\r$/, "")); rows.push(row);}
  return rows;
}

await Promise.all([mkdir(referenceDir, {recursive:true}),mkdir(licenseDir,{recursive:true})]);
const [codeRevision, merchantRevision] = await Promise.all([revision("greggles/mcc-codes"), revision("pointspick/mcc-database")]);
const [codesText, codeLicense, merchantsText, merchantReadme] = await Promise.all([
  fetchText(`https://raw.githubusercontent.com/greggles/mcc-codes/${codeRevision}/mcc_codes.json`),
  fetchText(`https://raw.githubusercontent.com/greggles/mcc-codes/${codeRevision}/LICENSE.txt`),
  fetchText(`https://raw.githubusercontent.com/pointspick/mcc-database/${merchantRevision}/data/merchant_mappings.csv`),
  fetchText(`https://raw.githubusercontent.com/pointspick/mcc-database/${merchantRevision}/README.md`),
]);
if (!codeLicense.includes("public domain") || !merchantReadme.includes("MIT License")) throw new Error("Dataset licensing changed; review before importing");
const sourceUpdatedAt = merchantReadme.match(/## Last Updated\s+(\d{4}-\d{2}-\d{2})/u)?.[1];
if (!sourceUpdatedAt || Number.isNaN(new Date(`${sourceUpdatedAt}T00:00:00Z`).valueOf())) throw new Error("Provider update date changed; review the source metadata");
const codes = JSON.parse(codesText).map(row => [row.mcc, row.edited_description.trim()]);
if (codes.length < 900 || codes.length > 3000 || codes.some(([code,label]) => !/^\d{4}$/.test(code) || !label || label.length > 240 || /[\u0000-\u001f]/u.test(label)) || new Set(codes.map(([code])=>code)).size !== codes.length) throw new Error("Invalid MCC reference");
const rows = parseCsv(merchantsText);
if (rows.shift().join(",") !== "merchant_name,slug,mcc_code,mcc_description,category") throw new Error("Merchant schema changed");
const mappings = rows.filter(row => row.length > 1).map(row => [row[0].trim(), row[2], row[4]]);
if (mappings.length < 6000 || mappings.length > 20000 || mappings.some(([name,code,category])=>!name || name.length > 240 || /[\u0000-\u001f]/u.test(name) || !/^\d{4}$/.test(code) || category.length > 80)) throw new Error("Invalid merchant reference");
await Promise.all([
  writeFile(path.join(referenceDir,"mcc-codes.json"), JSON.stringify(codes)+"\n"),
  writeFile(path.join(referenceDir,"global-merchants.json"), JSON.stringify(mappings)+"\n"),
  writeFile(path.join(referenceDir,"sources.json"), JSON.stringify({retrievedAt, codes:{repository:"https://github.com/greggles/mcc-codes",revision:codeRevision,license:"Unlicense",count:codes.length},merchants:{repository:"https://github.com/pointspick/mcc-database",revision:merchantRevision,license:"MIT (README grant)",sourceUpdatedAt,count:mappings.length}}, null, 2)+"\n"),
  writeFile(path.join(licenseDir,"mcc-codes-UNLICENSE.txt"),codeLicense),
  writeFile(path.join(licenseDir,"pointspick-attribution.md"),`PointsPick merchant mappings\n\nSource: https://github.com/pointspick/mcc-database/tree/${merchantRevision}\nAttribution requested by the provider: https://www.pointspick.com/tools/mcc-lookup\n\nThe README explicitly grants MIT License use with attribution. No separate LICENSE file or copyright holder notice is supplied in this revision. Preserve this grant and source attribution with every distribution. The imported data contains merchant names, MCC numbers and category labels only; no issuer rules are imported.\n\nRetrieved ${retrievedAt}. Provider source update: ${sourceUpdatedAt}. Country, payment channel and card network are unspecified.\n`),
]);
console.log(`Pinned ${codes.length} standard MCC descriptions and ${mappings.length} global merchant mappings. Review sources and tests before publishing.`);

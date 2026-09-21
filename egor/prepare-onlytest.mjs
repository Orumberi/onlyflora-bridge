// Prepares a new copy, never overwrites or uploads the supplied live template.
import { readFile, writeFile } from "node:fs/promises";
const [input, output, service] = process.argv.slice(2);
if (!input || !output || !service || input === output) throw new Error("Usage: node egor/prepare-onlytest.mjs INPUT OUTPUT HTTPS_SERVICE_ORIGIN");
const url = new URL(service);
if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Supply the HTTPS origin of the deployed Bridge, without paths or secrets");
const template = await readFile(input, "utf8");
if (!template.includes("</body>") || template.includes("onlyflora-onlytest-modern")) throw new Error("Expected a complete parent index.html without the OnlyFlora modern loader");
const snippet = '\n{* OnlyFlora modern preview: only the onlytest clone; remove this block to roll back. *}\n{if $wa_theme_id == \'onlytest\'}\n<script id="onlyflora-onlytest-modern" defer src="' + new URL("egor/theme.js", url).href + '"></script>\n<script id="onlyflora-egor-widget" defer src="' + new URL("egor/widget.js", url).href + '"></script>\n{/if}\n';
await writeFile(output, template.replace("</body>", snippet + "</body>"), { flag: "wx" });
console.log("Prepared an additional template copy. Not uploaded or activated.");

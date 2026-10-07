import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const source = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
for (const [name, size] of [["icon-192", 192], ["icon-512", 512], ["maskable-512", 512], ["apple-touch-icon", 180]]) {
  await sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}.png`, import.meta.url)));
}

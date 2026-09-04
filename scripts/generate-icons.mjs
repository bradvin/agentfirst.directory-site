import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = fileURLToPath(new URL("../public/favicon.svg", import.meta.url));
const appleTarget = fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url));
const faviconTarget = fileURLToPath(new URL("../public/favicon.ico", import.meta.url));

await sharp(source).resize(180, 180).png().toFile(appleTarget);

const png = await sharp(source).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const directoryEntry = Buffer.alloc(16);
directoryEntry.writeUInt8(32, 0);
directoryEntry.writeUInt8(32, 1);
directoryEntry.writeUInt8(0, 2);
directoryEntry.writeUInt8(0, 3);
directoryEntry.writeUInt16LE(1, 4);
directoryEntry.writeUInt16LE(32, 6);
directoryEntry.writeUInt32LE(png.length, 8);
directoryEntry.writeUInt32LE(header.length + directoryEntry.length, 12);

await writeFile(faviconTarget, Buffer.concat([header, directoryEntry, png]));

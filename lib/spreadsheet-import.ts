const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ENTRY_SIZE = 10 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 5_000;

type ZipEntry = {
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("csv-quotes-invalid");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function findEndOfCentralDirectory(view: DataView) {
  const minimumOffset = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("xlsx-directory-missing");
}

function readZipDirectory(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  const endOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);
  if (entryCount > MAX_ZIP_ENTRIES) throw new Error("xlsx-too-many-files");

  const entries = new Map<string, ZipEntry>();
  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("xlsx-directory-invalid");
    const compression = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));

    if (uncompressedSize > MAX_ENTRY_SIZE) throw new Error("xlsx-entry-too-large");
    if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("xlsx-entry-invalid");
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    entries.set(name, {
      compression,
      compressedSize,
      uncompressedSize,
      dataOffset: localOffset + 30 + localNameLength + localExtraLength,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const bytes = new Uint8Array(buffer, entry.dataOffset, entry.compressedSize);
  if (entry.compression === 0) return bytes;
  if (entry.compression !== 8 || typeof DecompressionStream === "undefined") throw new Error("xlsx-compression-unsupported");

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const output = new Uint8Array(await new Response(stream).arrayBuffer());
  if (output.byteLength > MAX_ENTRY_SIZE || output.byteLength !== entry.uncompressedSize) throw new Error("xlsx-entry-invalid");
  return output;
}

function decodeXml(value: string) {
  return value.replace(/&#(x[\da-f]+|\d+);|&(lt|gt|amp|quot|apos);/gi, (match, numeric: string | undefined, named: string | undefined) => {
    if (numeric) {
      const radix = numeric[0].toLowerCase() === "x" ? 16 : 10;
      return String.fromCodePoint(Number.parseInt(radix === 16 ? numeric.slice(1) : numeric, radix));
    }
    return { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" }[named!.toLowerCase() as "lt" | "gt" | "amp" | "quot" | "apos"] ?? match;
  });
}

function attribute(tag: string, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(new RegExp(`(?:^|\\s)${escapedName}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? decodeXml(match[1] ?? match[2] ?? "") : null;
}

function tags(xml: string, name: string) {
  return [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function tagContents(xml: string, name: string) {
  return [...xml.matchAll(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "gi"))].map((match) => match[1]);
}

function textContents(xml: string, name: string) {
  return tagContents(xml, name).map((value) => decodeXml(value.replace(/<[^>]+>/g, "")));
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!letters) return -1;
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function resolveWorksheetPath(workbookXml: string, relationshipsXml: string) {
  const firstSheet = tags(workbookXml, "sheet")[0];
  const relationshipId = firstSheet ? attribute(firstSheet, "r:id") : null;
  if (!relationshipId) throw new Error("xlsx-sheet-missing");

  const relationship = tags(relationshipsXml, "Relationship").find((item) => attribute(item, "Id") === relationshipId);
  const target = (relationship ? attribute(relationship, "Target") : null)?.replace(/^\//, "");
  if (!target || target.includes("..")) throw new Error("xlsx-sheet-missing");
  return target.startsWith("xl/") ? target : `xl/${target}`;
}

function readWorksheet(sheetXml: string, sharedStringsXml?: string) {
  const sharedStrings = sharedStringsXml
    ? tagContents(sharedStringsXml, "si").map((item) => textContents(item, "t").join(""))
    : [];
  const rows: string[][] = [];

  for (const rowXml of tagContents(sheetXml, "row")) {
    const row: string[] = [];
    const cells = [...rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)];
    for (const cell of cells) {
      const cellTag = `<c ${cell[1]}>`;
      const index = columnIndex(attribute(cellTag, "r") ?? "");
      if (index < 0 || index > 200) continue;
      const type = attribute(cellTag, "t");
      const rawValue = type === "inlineStr"
        ? textContents(cell[2], "t").join("")
        : textContents(cell[2], "v")[0] ?? "";
      row[index] = type === "s" ? sharedStrings[Number(rawValue)] ?? "" : rawValue;
    }
    if (row.some((value) => value?.trim())) rows.push(row.map((value) => value?.trim() ?? ""));
  }
  return rows;
}

async function parseXlsx(file: File) {
  const buffer = await file.arrayBuffer();
  const entries = readZipDirectory(buffer);
  const decoder = new TextDecoder();
  const readXml = async (path: string, optional = false) => {
    const entry = entries.get(path);
    if (!entry) {
      if (optional) return undefined;
      throw new Error("xlsx-file-missing");
    }
    return decoder.decode(await readZipEntry(buffer, entry));
  };

  const workbookXml = await readXml("xl/workbook.xml");
  const relationshipsXml = await readXml("xl/_rels/workbook.xml.rels");
  const worksheetPath = resolveWorksheetPath(workbookXml!, relationshipsXml!);
  const sheetXml = await readXml(worksheetPath);
  const sharedStringsXml = await readXml("xl/sharedStrings.xml", true);
  return readWorksheet(sheetXml!, sharedStringsXml);
}

export async function readSpreadsheetRows(file: File) {
  if (file.size > MAX_FILE_SIZE) throw new Error("spreadsheet-too-large");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") return parseXlsx(file);
  throw new Error("spreadsheet-type-unsupported");
}

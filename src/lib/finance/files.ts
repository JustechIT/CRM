export function invoiceFileInfo(bytes: Uint8Array, name: string) {
  const filename = name.replace(/[\r\n\x00]/g, "").trim();
  if (
    bytes.length === 0 ||
    bytes.length > 10485760 ||
    !filename ||
    filename.length > 250
  )
    return null;
  const mime =
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
      ? "application/pdf"
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? "image/jpeg"
        : bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10"
          ? "image/png"
          : null;
  return mime ? { mime, filename } : null;
}

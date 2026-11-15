/** Private file download (never cached by browsers or proxies). */
export function fileResponse(body: Buffer | string, contentType: string, filename: string, inline = false): Response {
  const safeName = filename.replace(/[^\w.-]+/g, "_");
  return new Response(typeof body === "string" ? body : new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

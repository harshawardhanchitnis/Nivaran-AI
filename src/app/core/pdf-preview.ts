export function signedDocumentUrl(url: string, origin: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.origin !== new URL(origin).origin ||
      !parsed.pathname.startsWith('/storage/v1/object/sign/evidence/') || !parsed.searchParams.has('token')) return null;
    return parsed.href;
  } catch { return null; }
}

/** Render the document locally for viewing; it is never OCR input for the agent. */
export async function pdfPagePreviews(url: string, pages: readonly number[], origin: string): Promise<Record<number, string>> {
  const signed = signedDocumentUrl(url, origin);
  if (!signed) throw new Error('This document link is not available. Retry opening it.');
  const response = await fetch(signed);
  if (!response.ok) throw new Error('Could not open this PDF. Retry opening the document.');
  const { getDocumentProxy, renderPageAsImage } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(await response.arrayBuffer()));
  const images: Record<number, string> = {};
  try {
    for (const page of new Set(pages)) {
      images[page] = URL.createObjectURL(new Blob([await renderPageAsImage(pdf, page, { width: 900 })], { type: 'image/png' }));
    }
    return images;
  } catch (error) {
    Object.values(images).forEach(url => URL.revokeObjectURL(url));
    throw error;
  } finally { await pdf.loadingTask.destroy(); }
}

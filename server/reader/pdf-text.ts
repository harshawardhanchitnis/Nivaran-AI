import { extractText, getDocumentProxy } from 'unpdf';
/** Require text on every page so a mixed scanned/text PDF cannot silently lose a page. */
export async function pdfTextPages(bytes:Uint8Array):Promise<string[]|null> {
  const pdf=await getDocumentProxy(bytes);
  try {
    const pages=(await extractText(pdf,{mergePages:false})).text;
    return pages.length && pages.every(page=>page.trim().length>0) ? pages : null;
  } finally { await pdf.loadingTask.destroy(); }
}

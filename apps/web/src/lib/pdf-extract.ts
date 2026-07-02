// Client-side PDF text extraction. pdfjs is dynamically imported ONLY when the
// user actually uploads a file, so it never bloats the initial bundle — and the
// whole parse runs in the browser, so it adds zero load/storage on our servers.
// We extract text only (no OCR): text-based resumes work; scanned/image PDFs
// return little text and are rejected upstream with a helpful message.

export interface PdfExtractResult {
    text: string;
    pages: number;
}

export class PdfTooManyPagesError extends Error {
    constructor(public pages: number, public maxPages: number) {
        super(`PDF has ${pages} pages (max ${maxPages})`);
        this.name = 'PdfTooManyPagesError';
    }
}

export async function extractPdfText(file: File, maxPages = 2): Promise<PdfExtractResult> {
    const pdfjs: any = await import('pdfjs-dist');
    // Worker resolved through the bundler (no external CDN — CSP-safe, offline-ok).
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages: number = doc.numPages;

    if (pages > maxPages) {
        await doc.destroy();
        throw new PdfTooManyPagesError(pages, maxPages);
    }

    let text = '';
    for (let i = 1; i <= pages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ') + '\n';
    }
    await doc.destroy();

    return { text: text.replace(/\s+\n/g, '\n').trim(), pages };
}

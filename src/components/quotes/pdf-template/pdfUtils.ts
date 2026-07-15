import html2canvas from 'html2canvas';
import html2pdf from 'html2pdf.js';
import { jsPDF } from 'jspdf';

interface GeneratePDFOptions {
  filename: string;
  element: HTMLElement;
  orientation?: 'portrait' | 'landscape';
  /** Evita `avoid-all`, que suele generar páginas en blanco en tablas largas. */
  paginateTables?: boolean;
}

const buildPdfOptions = (
  orientation: 'portrait' | 'landscape' = 'portrait',
  paginateTables = false,
) => ({
  margin: 0,
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { 
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
  },
  pagebreak: paginateTables
    ? {
        mode: ['css', 'legacy'] as const,
        after: ['.pdf-page-after'],
      }
    : { mode: ['avoid-all', 'css'] as const },
  jsPDF: { 
    unit: 'mm', 
    format: 'a4', 
    orientation,
  } as const
});

const pdfOptions = buildPdfOptions('portrait');

interface FlattenedPDFOptions {
  filename: string;
  element: HTMLElement;
  orientation?: 'portrait' | 'landscape';
  pageSelector?: string;
  scale?: number;
  jpegQuality?: number;
}

const A4_MM = { width: 210, height: 297 };

const getPageDimensionsMm = (orientation: 'portrait' | 'landscape') =>
  orientation === 'landscape'
    ? { width: A4_MM.height, height: A4_MM.width }
    : { width: A4_MM.width, height: A4_MM.height };

const createOffscreenCaptureRoot = (widthMm: number): HTMLDivElement => {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${widthMm}mm`,
    'background:#ffffff',
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
    'overflow:visible',
  ].join(';');
  document.body.appendChild(root);
  return root;
};

/**
 * Genera un PDF aplanado capturando cada hoja (.pdf-sheet) como imagen JPEG independiente.
 * Elimina el scroll jank causado por el canvas monolítico de html2pdf.
 */
export const generateFlattenedPDF = async ({
  filename,
  element,
  orientation = 'landscape',
  pageSelector = '.pdf-sheet',
  scale = 1.5,
  jpegQuality = 0.92,
}: FlattenedPDFOptions): Promise<void> => {
  const pages = element.querySelectorAll<HTMLElement>(pageSelector);
  if (pages.length === 0) {
    throw new Error(`No pages found with selector "${pageSelector}"`);
  }

  const { width: pageWidthMm, height: pageHeightMm } = getPageDimensionsMm(orientation);
  const pdf = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation,
    compress: true,
  });

  const captureRoot = createOffscreenCaptureRoot(pageWidthMm);

  try {
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        pdf.addPage();
      }

      const page = pages[i];
      const clone = page.cloneNode(true) as HTMLElement;
      captureRoot.replaceChildren(clone);

      const canvas = await html2canvas(clone, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });

      const aspectRatio = canvas.height / canvas.width;
      let drawWidth = pageWidthMm;
      let drawHeight = drawWidth * aspectRatio;

      if (drawHeight > pageHeightMm) {
        drawHeight = pageHeightMm;
        drawWidth = drawHeight / aspectRatio;
      }

      const offsetX = (pageWidthMm - drawWidth) / 2;
      const imgData = canvas.toDataURL('image/jpeg', jpegQuality);
      pdf.addImage(imgData, 'JPEG', offsetX, 0, drawWidth, drawHeight);

      canvas.width = 0;
      canvas.height = 0;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error generating flattened PDF:', error);
    throw new Error('Failed to generate flattened PDF');
  } finally {
    document.body.removeChild(captureRoot);
  }
};

export const generatePDF = async ({
  filename,
  element,
  orientation = 'portrait',
  paginateTables = false,
}: GeneratePDFOptions): Promise<void> => {
  try {
    await html2pdf()
      .set({ ...buildPdfOptions(orientation, paginateTables), filename })
      .from(element)
      .save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
};

/**
 * Genera el PDF y lo retorna como string base64 (data URI) sin descargarlo.
 */
export const generatePDFBase64 = async (element: HTMLElement): Promise<string> => {
  try {
    console.log('[Pdfutils] Iniciando generatePDFBase64...');
    const worker = html2pdf().set(pdfOptions).from(element);
    console.log('[Pdfutils] Worker creado, llamando outputPdf("blob")...');
    const blob: Blob = await worker.outputPdf('blob');
    console.log('[Pdfutils] Blob obtenido, tipo:', blob?.type, 'tamaño:', blob?.size);
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        console.log('[Pdfutils] FileReader completado, longitud resultado:', result?.length);
        resolve(result);
      };
      reader.onerror = (err) => {
        console.error('[Pdfutils] FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Error generating PDF base64:', error);
    throw new Error('Failed to generate PDF base64');
  }
};

/**
 * Descarga un PDF directamente desde un data URI base64 sin re-renderizar con html2pdf.
 * Úsalo en lugar de generatePDF() cuando ya tienes el base64 del paso anterior.
 */
export const downloadPDFFromBase64 = (base64DataUrl: string, filename: string): void => {
  const a = document.createElement('a');
  a.href = base64DataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const formatDateForFilename = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

/**
 * Obtiene la URL de la imagen del logo para usar en PDFs.
 * Intenta convertirla a data URL para evitar problemas de CORS con html2canvas.
 * Si falla, retorna la URL original como fallback.
 */
export const preloadLogoAsDataUrl = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
};
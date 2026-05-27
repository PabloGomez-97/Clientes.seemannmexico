import html2pdf from 'html2pdf.js';

interface GeneratePDFOptions {
  filename: string;
  element: HTMLElement;
}

const pdfOptions = {
  margin: 0,
  image: { type: 'jpeg' as const, quality: 0.98 },
  html2canvas: { 
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
  },
  pagebreak: {
    mode: ['avoid-all', 'css']
  },
  jsPDF: { 
    unit: 'mm', 
    format: 'a4', 
    orientation: 'portrait' 
  } as const
};

export const generatePDF = async ({ filename, element }: GeneratePDFOptions): Promise<void> => {
  try {
    await html2pdf().set({ ...pdfOptions, filename }).from(element).save();
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
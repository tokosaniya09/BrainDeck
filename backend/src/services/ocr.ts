import { createWorker } from 'tesseract.js';
import { logger } from '../utils/logger';

export interface OCROutput {
  text: string;
  confidence: number; // 0 to 100
  wordCount: number;
  lineCount: number;
  durationMs: number;
}

export interface IOCRService {
  extractText(imageBuffer: Buffer, mimeType?: string): Promise<OCROutput>;
  cleanExtractedText(rawText: string): string;
}

export class OCRService implements IOCRService {
  private workerInstance: any = null;

  /**
   * Cleans and sanitizes raw OCR output:
   * - Unifies newlines
   * - Joins hyphenated words split across lines (e.g. "com- / puter" -> "computer")
   * - Collapses redundant whitespace
   * - Trims non-printable artifact characters
   */
  public cleanExtractedText(rawText: string): string {
    if (!rawText) return '';

    return rawText
      // Remove zero-width and control characters (except standard newlines/tabs)
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      // Fix words broken by hyphenation at line ends: "trans-\nformer" -> "transformer"
      .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
      // Normalize line breaks to single spaces when inside a paragraph
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      // Collapse multiple horizontal spaces
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  /**
   * Performs optical character recognition on an image buffer.
   * Returns cleaned text, confidence score, and extraction metrics.
   */
  public async extractText(imageBuffer: Buffer, mimeType: string = 'image/png'): Promise<OCROutput> {
    const startTime = Date.now();
    logger.info('[OCR] Starting text extraction from image buffer', {
      byteLength: imageBuffer.length,
      mimeType,
    });

    let worker;
    try {
      worker = await createWorker('eng');
      const ret = await worker.recognize(imageBuffer);
      const durationMs = Date.now() - startTime;

      const rawText = ret.data.text || '';
      const confidence = ret.data.confidence ?? 0;
      const cleaned = this.cleanExtractedText(rawText);
      const words = cleaned ? cleaned.split(/\s+/).filter(Boolean) : [];
      const lines = cleaned ? cleaned.split('\n').filter(Boolean) : [];

      logger.info('[OCR] Extraction complete', {
        durationMs,
        confidence,
        rawLength: rawText.length,
        cleanedLength: cleaned.length,
        wordCount: words.length,
      });

      return {
        text: cleaned,
        confidence: Math.round(confidence),
        wordCount: words.length,
        lineCount: lines.length,
        durationMs,
      };
    } catch (error: any) {
      logger.error('[OCR] Extraction failed', {
        error: error?.message || error,
        durationMs: Date.now() - startTime,
      });
      throw new Error(`OCR processing failed: ${error?.message || 'Unknown error'}`);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          logger.debug('[OCR] Error terminating worker', { error: e });
        }
      }
    }
  }
}

export const ocrService = new OCRService();

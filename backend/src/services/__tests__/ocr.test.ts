// Vitest is provided by the test runner, but may not be included in the
// TypeScript project used for application builds.
// @ts-expect-error -- test-runner dependency is resolved at runtime.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OCRService } from '../ocr';

const mockRecognize = vi.fn();
const mockTerminate = vi.fn();

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => ({
    recognize: mockRecognize,
    terminate: mockTerminate,
  })),
}));

describe('OCRService Unit Tests', () => {
  let ocrService: OCRService;

  beforeEach(() => {
    vi.clearAllMocks();
    ocrService = new OCRService();
  });

  describe('cleanExtractedText', () => {
    it('returns empty string when input is null or empty', () => {
      expect(ocrService.cleanExtractedText('')).toBe('');
      expect(ocrService.cleanExtractedText(null as any)).toBe('');
    });

    it('merges hyphenated words split across lines', () => {
      const input = 'This is an ex-\nample of text split by a hy-\nphen.';
      const output = ocrService.cleanExtractedText(input);
      expect(output).toContain('example');
      expect(output).toContain('hyphen.');
    });

    it('removes zero-width and control characters', () => {
      const input = 'Clean\u200BText\uFEFFWith\u200CHiddenArtifacts';
      const output = ocrService.cleanExtractedText(input);
      expect(output).toBe('CleanTextWithHiddenArtifacts');
    });

    it('collapses excessive horizontal spaces and empty lines', () => {
      const input = 'Line 1    has   many     spaces.\n\n\n\nLine 2';
      const output = ocrService.cleanExtractedText(input);
      expect(output).toBe('Line 1 has many spaces.\n\nLine 2');
    });
  });

  describe('extractText', () => {
    it('successfully extracts text, calculates metrics, and cleans output', async () => {
      const mockRawText = 'Micro-\nservices architecture enables independent deployment.\nEach service scales.';
      mockRecognize.mockResolvedValueOnce({
        data: {
          text: mockRawText,
          confidence: 88.6,
        },
      });

      const fakeBuffer = Buffer.from('fake-image-bytes');
      const result = await ocrService.extractText(fakeBuffer, 'image/png');

      expect(result.confidence).toBe(89);
      expect(result.text).toContain('Microservices architecture enables independent deployment.');
      expect(result.wordCount).toBeGreaterThan(5);
      expect(result.lineCount).toBe(2);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockTerminate).toHaveBeenCalledTimes(1);
    });

    it('always terminates the worker even when recognition throws an error', async () => {
      mockRecognize.mockRejectedValueOnce(new Error('Tesseract engine crash'));

      const fakeBuffer = Buffer.from('corrupt-image');
      await expect(ocrService.extractText(fakeBuffer, 'image/jpeg')).rejects.toThrow(
        /OCR processing failed: Tesseract engine crash/
      );

      expect(mockTerminate).toHaveBeenCalledTimes(1);
    });
  });
});

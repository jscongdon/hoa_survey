/* @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { sanitizeSurveyHtml } from '@/lib/sanitizeHtml';

describe('sanitizeSurveyHtml', () => {
  it('preserves font-size style on span', () => {
    const html = '<p><span style="font-size:22px">Big text</span></p>';
    const out = sanitizeSurveyHtml(html);
    expect(out).toContain('font-size');
    expect(out).toMatch(/font-size:\s?22px/);
  });

  it('removes unknown style declarations', () => {
    const html = '<p><span style="font-size:22px; background-image:url(javascript:alert(1))">Big</span></p>';
    const out = sanitizeSurveyHtml(html);
    expect(out).toContain('font-size');
    expect(out).not.toContain('background-image');
  });
});

import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitize survey description HTML, allowing only a minimal set of tags
 * and a filtered set of style declarations (font-size only).
 */
export function sanitizeSurveyHtml(input: string) {
  if (!input) return input;

  const allowedTags = [
    'p', 'br', 'b', 'i', 'em', 'strong', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'a', 'span'
  ];

  const allowedAttr = ['href', 'target', 'rel', 'style'];

  const handler = (node: Element, data: any) => {
    // Filter style attributes to only allow `font-size` with allowed units
    if (data?.attrName === 'style' && typeof data.attrValue === 'string') {
      const val = data.attrValue;
      const parts = val.split(';').map((s) => s.trim()).filter(Boolean);
      const keep: string[] = [];
      for (const p of parts) {
        const [name, raw] = p.split(':').map((s) => s.trim());
        if (!name || !raw) continue;
        if (name.toLowerCase() === 'font-size') {
          // Allow px, em, rem, % and numeric values
          if (/^\d+(?:\.\d+)?(?:px|em|rem|%)$/i.test(raw)) {
            keep.push(`${name}: ${raw}`);
          }
        }
      }
      if (keep.length > 0) {
        data.attrValue = keep.join('; ');
      } else {
        // Remove the attribute entirely
        // data.keepAttr is respected by DOMPurify to remove attributes
        data.keepAttr = false;
      }
    }
  };

  // Attach the hook, call sanitize, then remove the hook to avoid side effects
  try {
    (DOMPurify as any).addHook('uponSanitizeAttribute', handler);
    const sanitized = DOMPurify.sanitize(String(input), { ALLOWED_TAGS: allowedTags, ALLOWED_ATTR: allowedAttr });
    return sanitized;
  } finally {
    try {
      (DOMPurify as any).removeHook('uponSanitizeAttribute', handler);
    } catch (e) {
      // ignore
    }
  }
}

export default sanitizeSurveyHtml;

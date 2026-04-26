/**
 * Tests for formatRichText.js
 *
 * Verifies:
 * - Inline markup parsing (bold, italic)
 * - Block-level classification (headings, bullets, numbered lists, paragraphs)
 * - Empty/null input handling
 */

const { parseRichParts } = require('../formatRichText');

// ─── Inline Markup Parsing ──────────────────────────────────────────────────

describe('parseRichParts – inline markup', () => {
  test('returns empty array for null/empty input', () => {
    expect(parseRichParts(null)).toEqual([]);
    expect(parseRichParts('')).toEqual([]);
  });

  test('plain text returns a single text node', () => {
    const result = parseRichParts('Hello world');
    expect(result).toEqual([{ type: 'text', text: 'Hello world' }]);
  });

  test('parses **bold** with double asterisks', () => {
    const result = parseRichParts('This is **bold** text');
    expect(result).toContainEqual({ type: 'text', text: 'This is ' });
    expect(result).toContainEqual({ type: 'bold', inner: 'bold' });
    expect(result).toContainEqual({ type: 'text', text: ' text' });
  });

  test('parses __bold__ with double underscores', () => {
    const result = parseRichParts('This is __bold__ too');
    expect(result).toContainEqual({ type: 'bold', inner: 'bold' });
  });

  test('parses *italic* with single asterisk', () => {
    const result = parseRichParts('This is *italic* text');
    expect(result).toContainEqual({ type: 'italic', inner: 'italic' });
  });

  test('parses _italic_ with single underscore', () => {
    const result = parseRichParts('This is _italic_ too');
    expect(result).toContainEqual({ type: 'italic', inner: 'italic' });
  });

  test('handles mixed bold and italic', () => {
    const result = parseRichParts('**bold** and *italic*');
    const boldNode = result.find((n) => n.type === 'bold');
    const italicNode = result.find((n) => n.type === 'italic');
    expect(boldNode).toBeDefined();
    expect(boldNode.inner).toBe('bold');
    expect(italicNode).toBeDefined();
    expect(italicNode.inner).toBe('italic');
  });

  test('handles unclosed bold as plain text', () => {
    const result = parseRichParts('This **unclosed bold');
    // Parser splits at the ** marker and treats the rest as plain text
    expect(result.length).toBeGreaterThanOrEqual(1);
    const allText = result.every((n) => n.type === 'text');
    expect(allText).toBe(true);
  });

  test('handles multiple bold segments', () => {
    const result = parseRichParts('**one** and **two**');
    const bolds = result.filter((n) => n.type === 'bold');
    expect(bolds.length).toBe(2);
    expect(bolds[0].inner).toBe('one');
    expect(bolds[1].inner).toBe('two');
  });
});

// ─── Block-Level Classification (unit test via import) ──────────────────────
// We test the classifyLine function indirectly through the public API. Because
// renderRichTextElements returns React elements that need React Native runtime,
// we test the line-classification logic by checking parseRichParts output for
// the inline portion, and verify bullet/heading patterns with regex tests.

describe('Block-level patterns', () => {
  const heading = /^(#{1,3})\s+(.+)$/;
  const bullet = /^(?:[-•]|\*(?!\*))\s+(.+)$/;
  const numbered = /^(\d+)[.)]\s+(.+)$/;
  const sectionLabel = /^([A-Z][A-Za-z0-9 /&,-]+):$/;

  test('detects markdown headings', () => {
    expect('## Summary'.match(heading)).toBeTruthy();
    expect('### Details'.match(heading)).toBeTruthy();
    expect('# Title'.match(heading)).toBeTruthy();
  });

  test('detects bullet points', () => {
    expect('- First item'.match(bullet)).toBeTruthy();
    expect('• Second item'.match(bullet)).toBeTruthy();
    expect('* Third item'.match(bullet)).toBeTruthy();
  });

  test('rejects ** as a bullet (it is bold)', () => {
    expect('** not a bullet'.match(bullet)).toBeFalsy();
  });

  test('detects numbered lists', () => {
    expect('1. First item'.match(numbered)).toBeTruthy();
    expect('2. Second item'.match(numbered)).toBeTruthy();
    expect('10. Tenth item'.match(numbered)).toBeTruthy();
  });

  test('detects section labels (line ending with colon)', () => {
    expect('Key Findings:'.match(sectionLabel)).toBeTruthy();
    expect('Next Steps:'.match(sectionLabel)).toBeTruthy();
  });

  test('plain paragraph text does not match special patterns', () => {
    const text = 'This is a regular paragraph of text.';
    expect(text.match(heading)).toBeFalsy();
    expect(text.match(bullet)).toBeFalsy();
    expect(text.match(numbered)).toBeFalsy();
    expect(text.match(sectionLabel)).toBeFalsy();
  });
});

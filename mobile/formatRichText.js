import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

// ─── Inline markup parser (bold / italic) ───────────────────────────────────

function findClosingSingleAsterisk(text, start) {
  for (let j = start; j < text.length; j++) {
    if (text[j] === '*') {
      if (text[j + 1] === '*') { j++; continue; }
      return j;
    }
  }
  return -1;
}

function findClosingSingleUnderscore(text, start) {
  for (let j = start; j < text.length; j++) {
    if (text[j] === '_') {
      if (text[j + 1] === '_') { j++; continue; }
      return j;
    }
  }
  return -1;
}

function findSingleItalicStart(text, i) {
  for (let j = i; j < text.length; j++) {
    if (text[j] === '*' && text[j + 1] !== '*') return j;
  }
  return -1;
}

function findSingleUnderStart(text, i) {
  for (let j = i; j < text.length; j++) {
    if (text[j] === '_' && text[j + 1] !== '_') return j;
  }
  return -1;
}

/**
 * Parse markdown-like inline markup into a flat list of typed segments.
 * Bold: **text** or __text__. Italic: *text* or _text_ (not ** or __).
 */
export function parseRichParts(text) {
  if (text == null || text === '') return [];
  const nodes = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end === -1) { nodes.push({ type: 'text', text: text.slice(i) }); break; }
      nodes.push({ type: 'bold', inner: text.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (text.startsWith('__', i)) {
      const end = text.indexOf('__', i + 2);
      if (end === -1) { nodes.push({ type: 'text', text: text.slice(i) }); break; }
      nodes.push({ type: 'bold', inner: text.slice(i + 2, end) });
      i = end + 2;
      continue;
    }
    if (text[i] === '*' && text[i + 1] !== '*') {
      const close = findClosingSingleAsterisk(text, i + 1);
      if (close !== -1) {
        nodes.push({ type: 'italic', inner: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }
    if (text[i] === '_' && text[i + 1] !== '_') {
      const close = findClosingSingleUnderscore(text, i + 1);
      if (close !== -1) {
        nodes.push({ type: 'italic', inner: text.slice(i + 1, close) });
        i = close + 1;
        continue;
      }
    }

    let next = text.length;
    const dStar = text.indexOf('**', i);
    const dUnder = text.indexOf('__', i);
    const sStar = findSingleItalicStart(text, i);
    const sUnder = findSingleUnderStart(text, i);
    for (const p of [dStar, dUnder, sStar, sUnder]) {
      if (p !== -1 && p < next) next = p;
    }
    if (next === i) {
      nodes.push({ type: 'text', text: text[i] });
      i += 1;
      continue;
    }
    nodes.push({ type: 'text', text: text.slice(i, next) });
    i = next;
  }
  return nodes;
}

function renderInlineParts(nodes, styles, keyPrefix) {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-${idx}`;
    if (node.type === 'text') {
      return <Text key={key}>{node.text}</Text>;
    }
    const innerParsed = parseRichParts(node.inner);
    const children =
      innerParsed.length > 0
        ? renderInlineParts(innerParsed, styles, key)
        : node.inner;

    if (node.type === 'bold') {
      return <Text key={key} style={styles.boldText}>{children}</Text>;
    }
    if (node.type === 'italic') {
      return <Text key={key} style={styles.italicText}>{children}</Text>;
    }
    return null;
  });
}

/** Render inline markup (bold + italic) into React Native <Text> children */
function renderInlineMarkup(text, styles, keyPrefix) {
  const nodes = parseRichParts(text);
  return renderInlineParts(nodes, styles, keyPrefix);
}

// ─── Block-level parser (headings, bullets, numbered lists, paragraphs) ─────

const LINE_PATTERNS = {
  /** Markdown heading: ## Heading or ### Heading */
  heading: /^(#{1,3})\s+(.+)$/,
  /** Line ending with a colon — treat as a section label */
  sectionLabel: /^([A-Z][A-Za-z0-9 /&,-]+):$/,
  /** Unordered bullet: - item, • item, * item (but not ** bold) */
  bullet: /^(?:[-•]|\*(?!\*))\s+(.+)$/,
  /** Ordered list: 1. item, 2) item */
  numbered: /^(\d+)[.)]\s+(.+)$/,
  /** Emoji section header: 📋 Title or ⚠️ Title */
  emojiHeading: /^([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]+)\s+(.+)$/u,
};

/**
 * Classify a single line into a block type.
 * Returns { type, content, level?, number? }
 */
function classifyLine(line) {
  const trimmed = line.trim();
  if (trimmed === '') return { type: 'blank' };

  let m;

  m = trimmed.match(LINE_PATTERNS.heading);
  if (m) return { type: 'heading', level: m[1].length, content: m[2] };

  m = trimmed.match(LINE_PATTERNS.bullet);
  if (m) return { type: 'bullet', content: m[1] };

  m = trimmed.match(LINE_PATTERNS.numbered);
  if (m) return { type: 'numbered', number: m[1], content: m[2] };

  m = trimmed.match(LINE_PATTERNS.sectionLabel);
  if (m) return { type: 'heading', level: 3, content: m[1] };

  return { type: 'paragraph', content: trimmed };
}

// ─── React Native renderers ────────────────────────────────────────────────

function HeadingBlock({ content, level, styles, keyPrefix }) {
  const fontSize = level === 1 ? 18 : level === 2 ? 16 : 15;
  return (
    <Text
      key={keyPrefix}
      style={[
        blockStyles.heading,
        { fontSize },
        styles.boldText,
      ]}
    >
      {renderInlineMarkup(content, styles, keyPrefix)}
    </Text>
  );
}

function BulletBlock({ content, styles, keyPrefix }) {
  return (
    <View key={keyPrefix} style={blockStyles.bulletRow}>
      <Text style={blockStyles.bulletDot}>{'•'}</Text>
      <Text style={blockStyles.bulletText}>
        {renderInlineMarkup(content, styles, keyPrefix)}
      </Text>
    </View>
  );
}

function NumberedBlock({ number, content, styles, keyPrefix }) {
  return (
    <View key={keyPrefix} style={blockStyles.bulletRow}>
      <Text style={blockStyles.numberLabel}>{number}.</Text>
      <Text style={blockStyles.bulletText}>
        {renderInlineMarkup(content, styles, keyPrefix)}
      </Text>
    </View>
  );
}

function ParagraphBlock({ content, styles, keyPrefix }) {
  return (
    <Text key={keyPrefix} style={blockStyles.paragraph}>
      {renderInlineMarkup(content, styles, keyPrefix)}
    </Text>
  );
}

// ─── Main public API ────────────────────────────────────────────────────────

/**
 * React Native <Text>/<View> tree for bot messages.
 * Supports: **bold**, *italic*, headings (## / :), bullets (-/•/*), numbered lists.
 */
export function renderRichTextElements(text, styles) {
  if (text == null || text === '') return null;

  const lines = text.split('\n');
  const elements = [];
  let prevType = null;

  lines.forEach((line, idx) => {
    const block = classifyLine(line);
    const key = `block-${idx}`;

    switch (block.type) {
      case 'blank':
        // Insert spacing between content blocks
        if (prevType && prevType !== 'blank') {
          elements.push(<View key={key} style={blockStyles.blankLine} />);
        }
        break;

      case 'heading':
        elements.push(
          <HeadingBlock
            key={key}
            content={block.content}
            level={block.level}
            styles={styles}
            keyPrefix={key}
          />
        );
        break;

      case 'bullet':
        elements.push(
          <BulletBlock
            key={key}
            content={block.content}
            styles={styles}
            keyPrefix={key}
          />
        );
        break;

      case 'numbered':
        elements.push(
          <NumberedBlock
            key={key}
            number={block.number}
            content={block.content}
            styles={styles}
            keyPrefix={key}
          />
        );
        break;

      case 'paragraph':
      default:
        elements.push(
          <ParagraphBlock
            key={key}
            content={block.content}
            styles={styles}
            keyPrefix={key}
          />
        );
        break;
    }

    prevType = block.type;
  });

  return <View style={blockStyles.container}>{elements}</View>;
}

// ─── Block-level styles ─────────────────────────────────────────────────────

const blockStyles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  heading: {
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 8,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 8,
    color: '#FF2D55',
    fontWeight: '700',
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    color: '#1C1C1E',
  },
  numberLabel: {
    fontSize: 14,
    lineHeight: 20,
    marginRight: 8,
    color: '#FF2D55',
    fontWeight: '700',
    minWidth: 20,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 21,
    color: '#1C1C1E',
    marginBottom: 4,
  },
  blankLine: {
    height: 8,
  },
});

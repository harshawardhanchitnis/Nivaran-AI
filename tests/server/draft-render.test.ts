import { describe, expect, it } from 'vitest';
import { renderDraft, fillPrivateDetails, draftLintSpans } from '../../shared/draft-render.js';
import { context } from '../fixtures/draft.js';
describe('code-only draft rendering', () => {
  it('inserts amounts, IDs and computed dates with their own source labels', () => {
    const rendered = renderDraft(
      'Refund {{fact:refund_amount}} for {{fact:order_id}}. Resolve by {{date:resolve_by}}. {{today}}',
      context,
    );
    expect(rendered.text).toBe(
      'Refund ₹9,999 [E02] for MM-123456 [your statement]. Resolve by 1 Nov 2026 [your statement]. 2 Oct 2026 [calculated]',
    );
    expect(rendered.spans).toHaveLength(4);
  });
  it('uses the cancellation source when code computed an explicitly disclosed working assumption', () => {
    const assumed = {
      ...context,
      facts: [
        ...context.facts,
        {
          field: 'cancellation_or_return_date',
          status: 'document' as const,
          value_text: '2026-09-17',
          value_norm: { kind: 'date', value: '2026-09-17' },
          evidence_item_id: 'reading',
        },
      ],
    };
    expect(renderDraft('Due {{date:refund_due}}', assumed).text).toBe('Due 24 Sept 2026 [E02]');
  });
  it('retains exact source spans after an edit but never trusts an unsupported value with a forged label', () => {
    const text = 'Updated: ₹9,999 [E02]. ₹8,999 [E02]. {{you:name}}';
    expect(
      draftLintSpans('{{fact:refund_amount}} {{you:name}}', text, context).map((span) =>
        text.slice(span.start, span.end),
      ),
    ).toEqual(['{{you:name}}', '₹9,999 [E02]']);
  });
  it.each([
    '{{fact:invented}}',
    '{{date:unknown}}',
    '{{you:phone}}',
    '{{fact:refund_reference}}',
    '{{broken',
    '}}',
  ])('rejects unknown, unavailable or malformed placeholders: %s', (template) => {
    expect(() => renderDraft(template, context)).toThrow();
  });
  it('does not render conflicting or unchecked values or invented document labels', () => {
    expect(() =>
      renderDraft('{{fact:refund_amount}}', {
        ...context,
        facts: context.facts.map((f) => ({ ...f, status: 'conflict' })),
      }),
    ).toThrow();
    expect(() => renderDraft('{{fact:refund_amount}}', { ...context, documents: [] })).toThrow();
  });
  it('keeps personal placeholders intact until filled locally and never renders HTML', () => {
    const rendered = renderDraft('{{you:name}}\n{{you:contact}}\n{{you:address}}', context);
    expect(rendered.text).toContain('{{you:name}}');
    const local = fillPrivateDetails(rendered.text, {
      name: '<script>private</script>',
      contact: '9999999999',
      address: 'Private street',
    });
    expect(local.text).toContain('<script>private</script>');
    expect(local.spans).toHaveLength(3);
    expect(rendered.text).not.toContain('private');
  });
});

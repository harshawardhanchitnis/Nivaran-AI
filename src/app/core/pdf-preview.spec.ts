import { signedDocumentUrl } from './pdf-preview';

describe('private source preview URL', () => {
  const origin = 'https://project.supabase.co';
  const url = `${origin}/storage/v1/object/sign/evidence/owner/case/doc.pdf?token=fictional`;
  it('accepts only a signed document at the configured project', () => {
    expect(signedDocumentUrl(url, origin)).toBe(url);
  });
  it.each(['javascript:alert(1)', 'https://other.example/storage/v1/object/sign/evidence/file?token=x', `${origin}/untrusted?token=x`, `${origin}/storage/v1/object/sign/evidence/file`])('refuses fetching %s', value => {
    expect(signedDocumentUrl(value, origin)).toBeNull();
  });
});

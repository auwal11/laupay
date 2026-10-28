import { BadRequestException } from '@nestjs/common';
import { assertEmailAllowed, emailDomain, isDisposableEmail, normalizeEmail } from './email-policy';

describe('email policy', () => {
  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeEmail('  Person@Example.COM ')).toBe('person@example.com');
    expect(emailDomain('Person@Example.COM')).toBe('example.com');
  });

  it.each([
    'bessy30651d@7o.xzcoot.com',
    'deni306361@h3f.paxeluni.com',
    'someone@mailinator.com',
    'someone@sub.temp-mail.org',
  ])('rejects disposable address %s', (email) => {
    expect(isDisposableEmail(email)).toBe(true);
    expect(() => assertEmailAllowed(email)).toThrow(BadRequestException);
  });

  it.each(['person@gmail.com', 'ops@laupay.app', 'user@test.local', 'student@nus.edu.sg'])(
    'accepts permanent address %s',
    (email) => {
      expect(isDisposableEmail(email)).toBe(false);
      expect(assertEmailAllowed(email)).toBe(normalizeEmail(email));
    },
  );
});

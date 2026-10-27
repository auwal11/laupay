import { toCsv } from './admin-ops.service';

describe('admin CSV exports', () => {
  it('neutralizes spreadsheet formula injection in user-controlled cells', () => {
    expect(toCsv([
      { name: '=HYPERLINK("https://attacker.invalid")', note: '+SUM(1,1)', phone: '-1234567890', tag: '@cmd' },
    ], ['name', 'note', 'phone', 'tag'])).toBe(
      'name,note,phone,tag\n' +
      '"\'=HYPERLINK(""https://attacker.invalid"")","\'+SUM(1,1)",\'-1234567890,\'@cmd',
    );
  });
});

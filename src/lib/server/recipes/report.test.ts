import { describe, expect, it } from 'vitest';
import { diagnosticsFromReport, findEmptyEntity } from './report';

const REPORT = `<span style='color:var(--yellow,#a60)'>Warning:</span> Unsupported value for key: &#39;servings&#39;
  <span>╰▶ </span> Expected &#39;number&#39; but got &#39;string&#39;
  ╭─<span>[</span>playground<span>]</span>
  │
4 │ &gt;&gt;<span> servings</span>:<span> 2</span>
──╯
<span style='color:var(--green,#0a0)'>Help:</span> It will be a regular metadata entry
`;

describe('diagnosticsFromReport', () => {
	it('extracts the warning, its source line and the suggestion', () => {
		expect(diagnosticsFromReport(REPORT)).toEqual([
			{
				severity: 'warning',
				message: "Unsupported value for key: 'servings'",
				line: 4
			},
			{
				severity: 'help',
				message: 'It will be a regular metadata entry',
				line: null
			}
		]);
	});

	it('returns nothing for an empty or clean report', () => {
		expect(diagnosticsFromReport('')).toEqual([]);
		expect(diagnosticsFromReport('   \n')).toEqual([]);
	});

	it('drops duplicate warnings', () => {
		const report = 'Warning: same thing\nWarning: same thing\n';
		expect(diagnosticsFromReport(report)).toHaveLength(1);
	});

	it('decodes numeric entities and strips ANSI colour', () => {
		const report = '\u001b[33mWarning:\u001b[0m can&#x27;t parse \u0026 continue';
		expect(diagnosticsFromReport(report)).toEqual([
			{ severity: 'warning', message: "can't parse & continue", line: null }
		]);
	});
});

describe('findEmptyEntity', () => {
	it('reports an empty ingredient with its line', () => {
		expect(findEmptyEntity('Add @salt{}\n\nThen @{} later.')).toEqual({
			message: 'An ingredient name is missing before the braces.',
			line: 3
		});
	});

	it('reports empty cookware and timers', () => {
		expect(findEmptyEntity('Use #{} now.')?.message).toContain('cookware');
		expect(findEmptyEntity('Wait ~{} now.')?.message).toContain('timer');
	});

	it('does not match a named or non-empty entity', () => {
		expect(findEmptyEntity('Add @salt{} and #pan{}.')).toBeNull();
		expect(findEmptyEntity('Add @salt{2%g}.')).toBeNull();
	});
});

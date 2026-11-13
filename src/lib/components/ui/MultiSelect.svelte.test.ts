import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import MultiSelect from './MultiSelect.svelte';

const options = ['baking', 'chicken', 'dessert', 'vegan'];

describe('MultiSelect', () => {
	it('closes the menu and clears the input after picking an option', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: [], options, label: 'Tags', onchange }
		});

		const input = screen.getByLabelText('Tags');
		await fireEvent.pointerDown(screen.getByLabelText('Toggle Tags options'));
		await fireEvent.input(input, { target: { value: 'chick' } });
		await fireEvent.pointerUp(await screen.findByRole('option', { name: 'chicken' }));

		expect(onchange).toHaveBeenLastCalledWith(['chicken']);
		expect(input).toHaveValue('');
		expect(input.parentElement).toContainElement(screen.getByLabelText('Remove chicken'));
		await waitFor(() => expect(screen.queryByRole('option', { name: 'baking' })).toBeNull());
	});

	it('leaves no label in the input when an option is picked without typing', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: [], options, label: 'Tags', onchange }
		});

		const input = screen.getByLabelText('Tags');
		await fireEvent.pointerDown(screen.getByLabelText('Toggle Tags options'));
		await fireEvent.pointerUp(await screen.findByRole('option', { name: 'vegan' }));

		expect(onchange).toHaveBeenLastCalledWith(['vegan']);
		expect(input).toHaveValue('');
	});

	it('renders the pills inside the input, ahead of the caret', async () => {
		render(MultiSelect, {
			props: { selected: ['baking', 'vegan'], options, label: 'Tags' }
		});

		const input = screen.getByLabelText('Tags');
		const shell = input.parentElement as HTMLElement;

		expect(shell).toContainElement(screen.getByLabelText('Remove baking'));
		expect(shell).toContainElement(screen.getByLabelText('Remove vegan'));
		expect(shell.lastElementChild).toBe(input);
	});

	it('removes the last pill on backspace in an empty input', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: ['baking', 'vegan'], options, label: 'Tags', onchange }
		});

		const input = screen.getByLabelText('Tags');
		input.focus();
		await fireEvent.keyDown(input, { key: 'Backspace' });

		expect(onchange).toHaveBeenCalledExactlyOnceWith(['baking']);
		expect(screen.queryByLabelText('Remove vegan')).toBeNull();
		expect(screen.getByLabelText('Remove baking')).toBeInTheDocument();
	});

	it('leaves the pills alone while backspace edits the query', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: ['baking', 'vegan'], options, label: 'Tags', onchange }
		});

		const input = screen.getByLabelText('Tags');
		await fireEvent.input(input, { target: { value: 'veg' } });
		await fireEvent.keyDown(input, { key: 'Backspace' });

		expect(onchange).not.toHaveBeenCalled();
		expect(screen.getByLabelText('Remove vegan')).toBeInTheDocument();
	});

	it('does not reopen the menu when backspace follows a pick', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: [], options, label: 'Tags', onchange }
		});

		const input = screen.getByLabelText('Tags');
		await fireEvent.pointerDown(screen.getByLabelText('Toggle Tags options'));
		await fireEvent.input(input, { target: { value: 'chick' } });
		await fireEvent.pointerUp(await screen.findByRole('option', { name: 'chicken' }));

		await fireEvent.keyDown(input, { key: 'Backspace' });

		expect(onchange).toHaveBeenLastCalledWith([]);
		expect(screen.queryByRole('option')).toBeNull();
	});

	it('highlights the first filtered match and moves with arrow keys', async () => {
		render(MultiSelect, {
			props: { selected: [], options: ['apple', 'sour cream', 'sugar', 'vegan'], label: 'Tags' }
		});

		const input = screen.getByLabelText('Tags');
		await fireEvent.pointerDown(screen.getByLabelText('Toggle Tags options'));
		await fireEvent.input(input, { target: { value: 's' } });

		await waitFor(() => {
			expect(document.querySelector('[data-highlighted]')).toHaveAttribute(
				'data-value',
				'sour cream'
			);
		});

		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		expect(document.querySelector('[data-highlighted]')).toHaveAttribute('data-value', 'sugar');
	});

	it('reports a removal when a chip is dismissed', async () => {
		const onchange = vi.fn();

		render(MultiSelect, {
			props: { selected: ['baking', 'vegan'], options, label: 'Tags', onchange }
		});

		await fireEvent.click(screen.getByLabelText('Remove baking'));

		expect(onchange).toHaveBeenCalledExactlyOnceWith(['vegan']);
	});
});

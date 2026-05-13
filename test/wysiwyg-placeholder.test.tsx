/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wysiwyg from '@/components/Wysiwyg';
import { vi } from 'vitest';

describe('Wysiwyg placeholder behavior', () => {
  test('placeholder is not visible when value provided', async () => {
    const onChange = vi.fn();
    render(<Wysiwyg value={"Some description"} onChange={onChange} placeholder="Survey description (supports rich text)" />);
    const editor = await screen.findByRole('textbox') as HTMLDivElement;
    // The editor should not have the 'empty' class when there is content
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(editor.className).not.toContain('empty');
  });

  test('placeholder shows when empty value provided and hides after typing', async () => {
    const onChange = vi.fn();
    render(<Wysiwyg value={""} onChange={onChange} placeholder="Survey description (supports rich text)" />);
    const editor = await screen.findByRole('textbox') as HTMLDivElement;
    expect(editor.className).toContain('empty');

    // Simulate typing into the editor
    editor.focus();
    await userEvent.type(editor, 'Hello');
    // Wait for the debounced onChange
    await new Promise((resolve) => setTimeout(resolve, 250));

    expect(onChange).toHaveBeenCalled();
    expect(editor.className).not.toContain('empty');
  });
});

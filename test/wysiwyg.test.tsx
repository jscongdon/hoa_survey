/* @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Wysiwyg from '@/components/Wysiwyg';
import { vi } from 'vitest';

describe('Wysiwyg', () => {
  test('creates a link and uses normalized URL', async () => {
    const onChange = vi.fn();
    render(<Wysiwyg value={"Hello world"} onChange={onChange} placeholder="desc" />);

    const editor = await screen.findByRole('textbox') as HTMLDivElement;
    // Set selection across 'world' text
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.setEnd(textNode, 11);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    // Mock prompt
    const spyPrompt = vi.spyOn(window, 'prompt').mockImplementation(() => 'example.com');
    // Provide a clipboard stub to satisfy user-event if needed
    // @ts-ignore
    global.navigator = global.navigator || {};
    // @ts-ignore
    global.navigator.clipboard = { writeText: async () => null };

    // click the 'Link' button (mousedown should save selection)
    const button = screen.getByRole('button', { name: /Add or edit link/i });
    // Ensure mousedown occurs, which saves selection
    import('@testing-library/react').then(({ fireEvent }) => fireEvent.mouseDown(button));
    await userEvent.click(button);

    // Next onChange should be invoked; wait for it
    // Wait for onChange to be called (postProcessCreatedLink uses a setTimeout)
    await new Promise((r) => setTimeout(r, 50));
    expect(onChange).toHaveBeenCalled();
    const calledHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(calledHtml).toContain('<a');
    expect(calledHtml).toContain('https://example.com');
    spyPrompt.mockRestore();
  });

  test('applies font size to selection', async () => {
    const onChange = vi.fn();
    render(<Wysiwyg value={"Hello world"} onChange={onChange} placeholder="desc" />);

    const editor = await screen.findByRole('textbox') as HTMLDivElement;
    const textNode = editor.firstChild as Text;
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, 5);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const largeBtn = screen.getByRole('button', { name: /Large text/i });
    await userEvent.click(largeBtn);
    // Next onChange should be invoked
    expect(onChange).toHaveBeenCalled();
    const calledHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // JSDOM may serialize style with a space after the colon
    expect(calledHtml).toMatch(/font-size:\s?22px/);
  });
});

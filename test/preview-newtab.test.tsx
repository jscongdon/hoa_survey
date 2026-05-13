/* @vitest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import SurveyForm from '@/components/SurveyForm';

beforeEach(() => {
  // @ts-ignore
  global.fetch = vi.fn((url) => {
    if ((url as string).includes('/api/member-lists')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) } as any);
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
  });
});

afterEach(() => {
  // @ts-ignore
  global.fetch = undefined;
  sessionStorage.clear();
});

test('preview in new tab stores payload and opens new window', async () => {
  const onSubmit = vi.fn(async () => {});
  render(<SurveyForm mode="create" initialValues={{ title: 'Test', description: '<p>Safe</p>' }} onSubmit={onSubmit} />);

  const btn = screen.getByRole('button', { name: /^Preview$/i });
  const openSpy = vi.spyOn(window, 'open').mockImplementation(() => window as any);

  fireEvent.click(btn);

  await waitFor(() => {
    expect(sessionStorage.getItem('hoa:surveyPreview')).toBeTruthy();
    const stored = JSON.parse(sessionStorage.getItem('hoa:surveyPreview') as string);
    expect(stored).toMatchObject({ title: 'Test' });
  });

  expect(openSpy).toHaveBeenCalledWith('/dashboard/surveys/preview', '_blank');
  openSpy.mockRestore();
});

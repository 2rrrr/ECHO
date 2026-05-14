// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlayerProgress } from './PlayerProgress';

describe('PlayerProgress', () => {
  it('previews drag position locally and commits only when released', () => {
    const onCommit = vi.fn();

    render(
      <PlayerProgress
        disabled={false}
        durationSeconds={180}
        positionSeconds={4}
        onCommit={onCommit}
      />,
    );

    const slider = screen.getByRole('slider', { name: 'Seek position' });
    expect(screen.getByText('0:04')).toBeTruthy();

    fireEvent.change(slider, { target: { value: '30' } });

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('0:30')).toBeTruthy();
    expect((slider as HTMLInputElement).value).toBe('30');

    fireEvent.pointerUp(slider);

    expect(onCommit).toHaveBeenCalledWith(30);
  });
});

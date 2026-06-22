import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('не отображается при пустом списке', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={0} onChange={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('показывает страницу и общее число', () => {
    render(<Pagination page={2} totalPages={3} total={57} onChange={() => {}} />);
    expect(screen.getByText(/Стр\. 2 из 3/)).toBeInTheDocument();
    expect(screen.getByText(/всего 57/)).toBeInTheDocument();
  });

  it('кнопка «Назад» зовёт onChange с предыдущей страницей', () => {
    const onChange = vi.fn();
    render(<Pagination page={2} totalPages={3} total={57} onChange={onChange} />);
    fireEvent.click(screen.getByText('Назад'));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('«Назад» заблокирована на первой странице', () => {
    render(<Pagination page={1} totalPages={3} total={57} onChange={() => {}} />);
    expect(screen.getByText('Назад')).toBeDisabled();
  });
});

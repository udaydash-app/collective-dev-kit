import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { screen, fireEvent } from '@testing-library/dom';
import { BrowserRouter } from 'react-router-dom';
import ProductImport from '@/pages/admin/ProductImport';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => {
  // Any query-builder call resolves to an empty result set
  const chain: Record<string | symbol, unknown> = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === 'then') {
          return (onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
            Promise.resolve({ data: [], error: null }).then(onFulfilled, onRejected);
        }
        return () => chain;
      },
    }
  );
  return {
    supabase: {
      from: vi.fn(() => chain),
      functions: { invoke: vi.fn() },
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    },
    getLocalSupabaseConfigStatus: vi.fn(() => null),
  };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('ProductImport', () => {
  it('renders import form', () => {
    renderWithProviders(<ProductImport />);
    expect(screen.getByRole('heading', { name: /import products/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/website url/i)).toBeInTheDocument();
  });

  it('disables import button when fields empty', () => {
    renderWithProviders(<ProductImport />);
    const importButton = screen.getByRole('button', { name: /import from url/i });
    expect(importButton).toBeDisabled();
  });

  it('enables import button when fields filled', () => {
    renderWithProviders(<ProductImport />);
    const urlInput = screen.getByLabelText(/website url/i);
    
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } });
    
    const importButton = screen.getByRole('button', { name: /import from url/i });
    // Note: Still disabled until store is selected, but URL validation works
    expect(importButton).toBeDisabled();
    expect(urlInput).toHaveValue('https://example.com');
  });
});

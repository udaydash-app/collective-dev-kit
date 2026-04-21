import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Route render failed", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  private handleReturnHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-background px-4 py-10 text-foreground">
        <section className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center text-center">
          <div className="rounded-full bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive">
            Page failed to load
          </div>
          <h1 className="mt-6 text-3xl font-bold">Something went wrong</h1>
          <p className="mt-3 text-muted-foreground">
            This page hit an unexpected error instead of loading normally.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReturnHome}
              className="rounded-md border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
            >
              Return home
            </button>
          </div>
        </section>
      </main>
    );
  }
}
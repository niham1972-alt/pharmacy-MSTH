import { Component, ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/** Ensures one widget crashing never takes down the rest of the dashboard (spec §12). */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-4 text-sm">
          <p className="font-medium text-red-700 dark:text-red-300">Couldn't load {this.props.title}</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 rounded-md border border-red-300 dark:border-red-800 px-3 py-1 text-red-700 dark:text-red-300"
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

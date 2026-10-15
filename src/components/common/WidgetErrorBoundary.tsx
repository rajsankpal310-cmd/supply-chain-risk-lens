import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  title?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Widget render error caught by boundary:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <Card className="p-4 border-dashed border-amber-500/40 bg-amber-500/5 flex flex-col items-center justify-center text-center gap-2">
          <AlertTriangle className="size-5 text-amber-500" />
          <p className="text-xs font-semibold text-foreground">
            {this.props.title || "Unable to display this widget"}
          </p>
          <p className="text-[11px] text-muted-foreground max-w-sm">
            {this.props.fallbackMessage || "A temporary rendering problem occurred in this section."}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="h-7 text-xs gap-1 mt-1">
            <RefreshCw className="size-3" /> Retry Section
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

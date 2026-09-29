import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface ActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  consequences: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
}

export function ActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  consequences,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
}: ActionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold">
            {isDestructive ? (
              <AlertTriangle className="size-5 text-destructive" aria-hidden />
            ) : (
              <Info className="size-5 text-primary" aria-hidden />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground pt-1">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {consequences.length > 0 && (
          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 my-2 space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
              What happens when you confirm:
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {consequences.map((c, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary font-bold">▪</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isLoading}
            className={
              isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {isLoading ? "Processing…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

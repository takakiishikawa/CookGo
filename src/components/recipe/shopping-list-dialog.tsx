"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetTitle,
  useIsMobile,
} from "@takaki/go-design-system";
import type { Recipe } from "@/types/database";
import { ShoppingListContent } from "@/components/recipe/shopping-list-content";

interface ShoppingListDialogProps {
  recipe: Recipe | null;
  onOpenChange: (open: boolean) => void;
}

export function ShoppingListDialog({
  recipe,
  onOpenChange,
}: ShoppingListDialogProps) {
  const isMobile = useIsMobile();
  const open = recipe !== null;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetTitle className="sr-only">Shopping List</SheetTitle>
          {recipe && <ShoppingListContent recipe={recipe} />}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto p-0 bg-transparent border-none shadow-none">
        <DialogTitle className="sr-only">Shopping List</DialogTitle>
        {recipe && <ShoppingListContent recipe={recipe} />}
      </DialogContent>
    </Dialog>
  );
}

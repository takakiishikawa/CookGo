import { AppHeader } from "@/components/layout/app-header";
import type { Recipe } from "@/types/database";
import { ShoppingListContent } from "@/components/recipe/shopping-list-content";

interface ShoppingClientProps {
  recipe: Recipe;
}

export function ShoppingClient({ recipe }: ShoppingClientProps) {
  return (
    <div className="flex flex-col">
      <AppHeader backHref="/recipes" title="Shopping List" />

      <div className="px-4 md:px-8 py-8 flex justify-center">
        <div className="w-full max-w-sm">
          <ShoppingListContent recipe={recipe} />
        </div>
      </div>
    </div>
  );
}

import type { JSX } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import EditMenuItems from "./EditMenuItems";

// Standalone "Edit" dropdown for views without view-specific edit actions
// (tree, distance matrix). MSA composes EditMenuItems into its richer EditDropdown.
export default function EditMenu(): JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">Edit</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-max p-1">
        <EditMenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

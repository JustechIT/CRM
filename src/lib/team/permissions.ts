import { moduleChoices, type ModuleGrant } from "./config";
export const permissionGroups = [
  { id: "all", label: "All modules", modules: moduleChoices.map(([id]) => id) },
  {
    id: "justech",
    label: "Justech",
    modules: ["sales", "marketing", "operations", "training"],
  },
  {
    id: "alfikr",
    label: "Al-Fikr",
    modules: ["alfikr-sales", "alfikr-marketing", "alfikr-content"],
  },
  {
    id: "workspace",
    label: "Workspace",
    modules: ["priorities", "platform", "events"],
  },
  { id: "directory", label: "Accounts & Contacts", modules: ["directory"] },
];
export type PermissionPreset = "none" | "view" | "edit" | "full";
// Bulk controls change only the selected modules; private Finance is never included.
export function applyPermissionPreset(
  current: ModuleGrant[],
  modules: string[],
  preset: PermissionPreset,
  role: string,
): ModuleGrant[] {
  const valid = new Set(moduleChoices.map(([id]) => id as string));
  const selected = new Set(modules.filter((id) => valid.has(id)));
  const result = current.filter((g) => !selected.has(g.module));
  for (const moduleId of selected)
    result.push({
      module: moduleId,
      read: preset !== "none",
      write: role !== "viewer" && (preset === "edit" || preset === "full"),
      delete: role !== "viewer" && preset === "full",
    });
  return result;
}

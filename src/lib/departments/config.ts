import { alfikrSections, isAlFikr } from "@/lib/alfikr/config";
import { workspaceSections, isWorkspaceScope } from "@/lib/workspace/config";
import type {
  ModuleScope,
  Department,
  Section,
  Indicator,
  Params,
} from "./types";
import { marketingSections, marketingIndicators } from "./marketing";
import { operationsSections, operationsIndicators } from "./operations";
import { trainingSections, trainingIndicators } from "./training";
export const departments: Department[] = [
  "marketing",
  "operations",
  "training",
];
export const departmentTitles: Record<Department, string> = {
  marketing: "Marketing",
  operations: "Operations",
  training: "Training",
};
export const sections: Section[] = [
  ...marketingSections,
  ...operationsSections,
  ...trainingSections,
];
export const indicators: Record<Department, Indicator[]> = {
  marketing: marketingIndicators,
  operations: operationsIndicators,
  training: trainingIndicators,
};
export function isDepartment(value: unknown): value is Department {
  return departments.includes(value as Department);
}
export function isModuleScope(v: unknown): v is ModuleScope {
  return isDepartment(v) || isWorkspaceScope(v) || isAlFikr(v);
}
export function getSection(department: ModuleScope, slug: string) {
  return [...sections, ...workspaceSections, ...alfikrSections].find(
    (s) => s.department === department && s.slug === slug,
  );
}
export function modulePath(
  department: ModuleScope,
  slug = "overview",
  params: Record<string, string> = {},
) {
  const query = new URLSearchParams(params);
  if (isAlFikr(department))
    return `/modules/${department}/${slug}${query.size ? "?" + query : ""}`;
  if (isWorkspaceScope(department)) {
    if (department === "events") {
      if (slug === "conferences") query.set("section", "conferences");
      return `/modules/workspace/events${query.size ? "?" + query : ""}`;
    }
    const path =
      department === "platform" && slug === "issues"
        ? "platform/issues"
        : department;
    return `/modules/workspace/${path}${query.size ? "?" + query : ""}`;
  }
  return `/modules/justech-${department}/${slug}${query.size ? "?" + query : ""}`;
}
export function param(params: Params, key: string) {
  return typeof params[key] === "string" ? params[key] : "";
}
export function value(
  record: Record<string, unknown> | undefined,
  key: string,
) {
  const v = record?.[key];
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
export function recordLabel(section: Section, record: Record<string, unknown>) {
  const f = section.fields[0];
  return value(record, f.type === "reference" ? f.key + "_label" : f.key);
}

import { z } from "zod";
export const moduleChoices = [
  ["directory", "Accounts & Contacts"],
  ["sales", "Justech Sales"],
  ["marketing", "Marketing"],
  ["operations", "Operations"],
  ["training", "Training"],
  ["priorities", "Team Priorities"],
  ["platform", "IT & Platform Management"],
  ["events", "Conferences & Events"],
  ["alfikr-sales", "Al-Fikr Sales"],
  ["alfikr-marketing", "Al-Fikr Marketing"],
  ["alfikr-content", "Al-Fikr Content Management"],
] as const;
export const roleChoices = [
  ["manager", "Manager"],
  ["employee", "Employee"],
  ["viewer", "Viewer"],
] as const;
export const moduleSchema = z
  .object({
    module: z.enum(moduleChoices.map((m) => m[0]) as [string, ...string[]]),
    read: z.boolean(),
    write: z.boolean(),
    delete: z.boolean(),
  })
  .refine((v) => v.read || (!v.write && !v.delete), {
    message: "Enable Read before Write or Delete.",
  });
export const userSchema = z
  .object({
    id: z.uuid().optional(),
    full_name: z.string().trim().min(1).max(200),
    email: z.email().optional(),
    department: z.enum([
      "sales",
      "marketing",
      "operations",
      "training",
      "it",
      "management",
    ]),
    role: z.enum(["manager", "employee", "viewer"]),
    active: z.boolean(),
    supplier_access: z.boolean(),
    modules: z.array(moduleSchema).max(11),
    remove: z.boolean().default(false),
  })
  .refine(
    (v) => new Set(v.modules.map((m) => m.module)).size === v.modules.length,
    { message: "Each module can appear once." },
  );
export type ModuleGrant = z.infer<typeof moduleSchema>;
export type TeamUser = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  date_added: string;
  removed_at: string | null;
  role_id: string;
  departments: { id: string; name: string }[];
  legacy_roles: string;
  modules: ModuleGrant[];
  supplier_access: boolean;
};

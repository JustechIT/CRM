export type Department = "marketing" | "operations" | "training";
export type ModuleScope = Department | "priorities" | "platform" | "events";
export type Reference =
  | "employees"
  | "products"
  | "accounts"
  | "contacts"
  | "projects"
  | "sessions"
  | "departments"
  | "itprojects";
export type Field = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "date"
    | "url"
    | "email"
    | "integer"
    | "money"
    | "select"
    | "reference"
    | "project"
    | "party";
  required?: boolean;
  options?: readonly string[];
  reference?: Reference;
  help?: string;
  max?: number;
};
export type Section = {
  department: ModuleScope;
  slug: string;
  title: string;
  singular: string;
  table: string;
  view: string;
  fields: Field[];
  defaultSort: string;
  statusKey: string;
  scope?: string;
  scopeField?: string;
  extraFields?: Field[];
  sheet: string;
};
export type Indicator = {
  key: string;
  label: string;
  section: string;
  filter?: Record<string, string>;
  description: string;
};
export type RecordRow = {
  id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};
export type Params = Record<string, string | string[] | undefined>;

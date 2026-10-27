import { ArrowUpRight, FolderOpen } from "lucide-react";
import Link from "next/link";
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="actions">{children}</div>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <FolderOpen size={23} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function SetupNotice() {
  return (
    <div className="notice">
      <div>
        <strong>Connect your workspace</strong>
        <p>
          Supabase is not configured. This safe preview contains no customer
          data. Connect a project and apply the database migration to enable
          employee access.
        </p>
      </div>
      <Link href="/settings" className="text-link">
        Setup guide <ArrowUpRight size={15} />
      </Link>
    </div>
  );
}
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="badge">{children}</span>;
}

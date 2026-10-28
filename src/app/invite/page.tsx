import { AcceptInvite } from "@/components/team/invite-accept";
import { isConfigured } from "@/lib/supabase";
export default async function Invite() {
  return (
    <main className="main-content">
      <section className="panel">
        <h1>Join your Justech workspace</h1>
        <p>
          Open your invitation email link, choose your password, then accept
          your invitation.
        </p>
        <AcceptInvite configured={isConfigured()} />
      </section>
    </main>
  );
}

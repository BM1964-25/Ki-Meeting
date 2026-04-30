import { ShieldCheck } from "lucide-react";

export function PrivacyNotice() {
  return (
    <div className="privacy-notice">
      <ShieldCheck size={18} aria-hidden="true" />
      <p>
        Hinweis: Bei der Verarbeitung personenbezogener Daten sind Datenschutzgrundlagen,
        Vertraulichkeitspflichten und unternehmensinterne Compliance-Vorgaben zu beachten.
      </p>
    </div>
  );
}

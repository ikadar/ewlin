import type { ReactElement } from 'react';

export interface IdentitySectionProps {
  jobReference: string;
  client: string;
  designation?: string;
}

export function IdentitySection({ jobReference, client, designation }: IdentitySectionProps): ReactElement {
  return (
    <div className="text-center py-4 px-5 border-b border-flux-border" data-testid="pm-identity">
      <div className="text-[15px] font-bold text-flux-text-primary tracking-tight">
        {jobReference} · {client}
      </div>
      {designation && (
        <div className="text-[12px] text-flux-text-tertiary mt-0.5">{designation}</div>
      )}
    </div>
  );
}

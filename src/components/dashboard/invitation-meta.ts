import { DUO_CATEGORY_LABELS, type Invitation } from "./types";

/**
 * Metaregel onder een uitnodiging: wie (weergavenaam, nooit e-mail), regio
 * en optioneel speltype. "Van Sanne de Vries · Utrecht · Gemengd" zonder
 * middelpunten: gescheiden door komma's.
 */
export function invitationMeta(invitation: Invitation, direction: "received" | "sent"): string {
  const who = direction === "received" ? `Van ${invitation.proposedByName}` : `Aan ${invitation.invitedUserName}`;
  const parts = [who];
  if (invitation.region?.name) parts.push(invitation.region.name);
  if (invitation.category) parts.push(DUO_CATEGORY_LABELS[invitation.category]);
  return parts.join(", ");
}

import {
  startAuthentication,
  startRegistration,
  WebAuthnError,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { api, type Passkey } from "./api";

export async function addPasskey(name: string | undefined): Promise<Passkey> {
  const { options } = await api<{ options: PublicKeyCredentialCreationOptionsJSON }>(
    "/v1/me/passkeys/options",
    { method: "POST" },
  );
  const response = await startRegistration({ optionsJSON: options });
  const { passkey } = await api<{ passkey: Passkey }>("/v1/me/passkeys", {
    method: "POST",
    body: { response, ...(name && { name }) },
  });
  return passkey;
}

/** Confirms a passkey, which lets this session make sensitive changes for five minutes. */
export async function confirmPasskey(): Promise<void> {
  const { options } = await api<{ options: PublicKeyCredentialRequestOptionsJSON }>(
    "/v1/me/step-up/options",
    { method: "POST" },
  );
  const response = await startAuthentication({ optionsJSON: options });
  await api("/v1/me/step-up", { method: "POST", body: { response } });
}

export function passkeyError(err: unknown, fallback: string): string {
  if (err instanceof WebAuthnError && err.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "This device already has a passkey for your account.";
  }
  if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError")) {
    return "The passkey prompt was closed before it finished.";
  }
  return err instanceof Error ? err.message : fallback;
}

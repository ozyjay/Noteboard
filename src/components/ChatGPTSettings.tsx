import { useEffect, useState } from "react";
import { bridge, type ChatGPTAccount } from "../bridge";
import { invalidateChatGPTModels } from "../model-discovery";
export function ChatGPTSettings({
  accountId,
  onAccount,
  onError,
  onBusy,
}: {
  accountId?: string;
  onAccount: (id?: string) => void;
  onError: (message: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<ChatGPTAccount[]>([]);
  const [working, setWorking] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [notice, setNotice] = useState("");
  const account = accounts.find((a) => a.id === accountId);
  useEffect(() => {
    let active = true;
    bridge
      .chatgptAccounts()
      .then((values) => {
        if (active) setAccounts(values);
      })
      .catch((error) => {
        if (active) onError(String(error));
      });
    return () => {
      active = false;
      void bridge.chatgptCancelSignIn().catch(() => {});
    };
  }, []);
  async function signIn() {
    setSigningIn(true);
    setWorking(true);
    onBusy(true);
    onError("");
    setNotice("");
    try {
      const values = await bridge.chatgptSignIn(accountId);
      setAccounts(values);
      const selected = accountId
        ? values.find((a) => a.id === accountId)
        : values.at(-1);
      if (selected) {
        invalidateChatGPTModels(selected.id);
        onAccount(selected.id);
        if (
          selected.planEnabled &&
          !localStorage.getItem(`inquiry.chatgpt.welcome.${selected.id}`)
        )
          setWelcome(true);
        if (!selected.planEnabled)
          setNotice(
            "Connected for identity only. Sign in again and allow ChatGPT plan usage to generate responses.",
          );
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setSigningIn(false);
      setWorking(false);
      onBusy(false);
    }
  }
  async function signOut() {
    if (!accountId) return;
    setWorking(true);
    onBusy(true);
    onError("");
    try {
      const { revoked } = await bridge.chatgptSignOut(accountId);
      invalidateChatGPTModels(accountId);
      setAccounts(await bridge.chatgptAccounts());
      setNotice(
        revoked
          ? "Signed out of this ChatGPT account."
          : "Signed out locally. Remote revocation was not confirmed; disconnect Noteboard in ChatGPT settings.",
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    } finally {
      setWorking(false);
      onBusy(false);
    }
  }
  return (
    <div className="chatgpt-settings">
      <p className="muted small">
        Use your eligible ChatGPT plan for Notes and synthesis. Allow plan usage
        in the browser during sign-in. Usage and any authorised credits are
        managed in ChatGPT settings.
      </p>
      <label>
        ChatGPT account
        <select
          aria-label="ChatGPT account"
          required
          value={accountId || ""}
          disabled={working}
          onChange={(event) => {
            onAccount(event.target.value || undefined);
            setNotice("");
          }}
        >
          <option value="">Add another account or workspace</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {a.connected ? "" : " · signed out"}
            </option>
          ))}
        </select>
      </label>
      {account && (
        <p className="muted small">
          {account.connected
            ? account.planEnabled
              ? "Using ChatGPT plan"
              : "Plan usage permission required"
            : "Sign in to reconnect this account"}
        </p>
      )}
      <div className="account-actions">
        <button
          type="button"
          className="chatgpt-signin"
          disabled={working}
          onClick={signIn}
        >
          {signingIn ? "Waiting for ChatGPT…" : "Continue with ChatGPT"}
        </button>
        {signingIn && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void bridge
                .chatgptCancelSignIn()
                .catch((error) => onError(String(error)))
            }
          >
            Cancel sign-in
          </button>
        )}
        {account?.connected && (
          <button
            type="button"
            className="secondary"
            disabled={working}
            onClick={signOut}
          >
            Sign out
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() =>
            void bridge.chatgptUsage().catch((error) => onError(String(error)))
          }
        >
          Manage usage
        </button>
      </div>
      {welcome && (
        <div className="reminder" role="status">
          <strong>You’re using your ChatGPT plan</strong>
          <p>
            Eligible requests in Noteboard use your ChatGPT plan. You can manage
            usage and access in ChatGPT settings.
          </p>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (accountId)
                localStorage.setItem(
                  `inquiry.chatgpt.welcome.${accountId}`,
                  "seen",
                );
              setWelcome(false);
            }}
          >
            Got it
          </button>
        </div>
      )}
      {notice && (
        <p className="muted small" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

type RecoveryAuth = {
  getUser: () => Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
};

// Uses only the provider's authenticated identity; never accepts a target account.
export async function changeRecoveredPassword(
  auth: RecoveryAuth,
  password: string,
  confirmation: string,
) {
  if (password.length < 12 || password !== confirmation)
    throw Error("Use at least 12 characters and make both passwords match.");
  const user = await auth.getUser();
  if (user.error || !user.data.user)
    throw Error("Your recovery session has expired. Request a new email.");
  const changed = await auth.updateUser({ password });
  if (changed.error)
    throw Error(
      "Password could not be changed. Use a different, stronger password, or request a fresh recovery link.",
    );
  // A sign-out service failure must not imply that the successful password update failed.
  try {
    return { signedOut: !(await auth.signOut()).error };
  } catch {
    return { signedOut: false };
  }
}

/// <reference types="vite/client" />
type User = { id: string; email: string; emailVerified: boolean };
type LoginSession = { user: User; expiresAt: number };
type LoginResult = ({ ok: true } & LoginSession) | { ok: false; code: string };
type SignupResult = { ok: true; user: User; verificationEmailSent?: boolean } | { ok: false; code: string };
type MonitorNode = { id: string; name: string; platform: string; online: boolean; lastSeenAt: string | null };
type MacroPreset = { id: string; name: string; icon: string | null };
type PresetResult = { ok: true; presets: MacroPreset[] } | { ok: false; code: string };
interface Window {
  marioNet?: {
    verification(resend?: boolean): Promise<{ ok: boolean; code?: string; emailVerified?: boolean }>;
    signin(input: { email: string; password: string }): Promise<LoginResult>;
    signup(input: { email: string; password: string }): Promise<SignupResult>;
    getSession(): Promise<LoginSession | null>;
    signout(): Promise<{ ok: boolean; code?: string }>;
    listNodes(): Promise<{ ok: true; nodes: MonitorNode[] } | { ok: false; code: string }>;
    listPresets(): Promise<PresetResult>;
    savePreset(preset: { id?: string; name: string; icon: string | null }): Promise<PresetResult>;
    deletePreset(id: string): Promise<PresetResult>;
    onExpired(callback: () => void): () => void;
    minimize(): void;
    maximize(): void;
    close(): void;
  };
}



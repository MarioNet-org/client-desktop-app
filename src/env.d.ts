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
    requestConnection(nodeId: string): Promise<{ ok: true; connection: { id: string; status: string; nodeId: string } } | { ok: false; code: string }>;
    closeConnection(connectionId: string): Promise<{ ok: boolean; code?: string }>;
    sendWebRtcSignal(signal: { connectionId: string; kind: 'offer' | 'answer' | 'ice'; payload: unknown }): Promise<{ ok: boolean; code?: string }>;
    onConnectionUpdated(callback: (connection: { id: string; status: string; nodeId: string }) => void): () => void;
    onWebRtcSignal(callback: (signal: { connectionId: string; kind: 'offer' | 'answer' | 'ice'; payload: unknown }) => void): () => void;
    listPresets(): Promise<PresetResult>;
    savePreset(preset: { id?: string; name: string; icon: string | null }): Promise<PresetResult>;
    deletePreset(id: string): Promise<PresetResult>;
    onExpired(callback: () => void): () => void;
    minimize(): void;
    maximize(): void;
    close(): void;
  };
}



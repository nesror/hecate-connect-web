import { normalizeProfile } from './profileIO';
import type { Profile, StoredState } from './types';

const STORAGE_KEY = 'hecate-connect-web:state:v1';

export function loadStoredState(): StoredState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    const record = data as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.profiles)) return null;
    const profiles = record.profiles
      .map((item) => normalizeProfile(item, '配置文件'))
      .filter((profile): profile is Profile => profile !== null);
    if (!profiles.length) return null;
    const activeExists = profiles.some((profile) => profile.id === record.activeId);
    return {
      version: 1,
      profiles,
      activeId: activeExists ? String(record.activeId) : profiles[0].id,
    };
  } catch (error) {
    console.warn('读取本地配置失败，已使用默认配置。', error);
    return null;
  }
}

export function persistState(profiles: Profile[], activeId: string): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, profiles, activeId }));
    return true;
  } catch (error) {
    console.error('保存本地配置失败。', error);
    return false;
  }
}

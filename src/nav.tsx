// App-wide navigation helpers for overlays that can be opened from anywhere (public profile, chat, online area).
import { createContext, useContext } from 'react';

export type OnlineEntry = 'hub' | 'tours' | 'ranks' | 'arena' | 'challenges' | 'leagues' | 'social' | 'duels' | 'worldcup'
  | { k: 'user' | 'chat' | 'club'; id: string };
export type Nav = {
  toast: (m: string, k?: string) => void;
  openOnline: (e?: OnlineEntry) => void;
  openProfile: (uid: string) => void;
  openChat: (conversationId: string) => void;
  openClub: (clubId: string) => void;
  openTeam: () => void;
  openAuth?: (mode?: 'up' | 'in') => void;
};
export const NavCtx = createContext<Nav>({ toast: () => {}, openOnline: () => {}, openProfile: () => {}, openChat: () => {}, openClub: () => {}, openTeam: () => {} });
export const useNav = () => useContext(NavCtx);

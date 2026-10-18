"use client";

import { useState } from "react";
import { signOutToLogin } from "@/lib/supabase/sign-out";
import { Avatar } from "./Avatar";

interface ProfilePopupProps {
  name: string;
  favCount: number;
  likeCount: number;
  peopleCount: number;
  onClose: () => void;
  onOpenSettings: () => void;
}

function MenuItem({
  label,
  trailing,
  danger,
  onClick,
}: {
  label: string;
  trailing?: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[46px] w-full items-center justify-between px-[18px] text-[13px] font-bold transition-colors active:bg-[#F6F4EF] hover:bg-[#F6F4EF] ${
        danger ? "text-[#A3301F]" : "text-text-primary"
      }`}
    >
      <span>{label}</span>
      {trailing && (
        <span className="font-mono text-[11px] text-text-tertiary">{trailing}</span>
      )}
    </button>
  );
}

export function ProfilePopup({
  name,
  favCount,
  likeCount,
  peopleCount,
  onClose,
  onOpenSettings,
}: ProfilePopupProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    await signOutToLogin();
  }

  return (
    <div
      className="absolute inset-0 z-[80]"
      style={{ backgroundColor: "rgba(26,24,19,0.12)" }}
      onClick={onClose}
    >
      <div
        className="animate-popup-in absolute right-4 top-14 w-[248px] origin-top-right overflow-hidden rounded-[20px] border border-card-border bg-white"
        style={{ boxShadow: "0 18px 44px rgba(26,24,19,0.16)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3 px-[18px] pb-4 pt-[18px]">
          <Avatar name={name} color="#1A1813" size={44} className="text-[18px] font-bold" />
          <div>
            <p className="text-base font-black text-text-primary">{name}</p>
            <p className="font-mono text-[10px] text-text-tertiary">
              食べたい {favCount} · いいね {likeCount}
            </p>
          </div>
        </div>
        <div className="border-t border-card-border py-1.5">
          <MenuItem label="プロフィールを編集" onClick={onOpenSettings} />
          <MenuItem label="一緒に行く人" trailing={`${peopleCount}人`} />
          <MenuItem label="設定" onClick={onOpenSettings} />
        </div>
        <div className="border-t border-card-border py-1.5">
          <MenuItem
            label={loggingOut ? "ログアウト中…" : "ログアウト"}
            danger
            onClick={handleLogout}
          />
        </div>
      </div>
    </div>
  );
}

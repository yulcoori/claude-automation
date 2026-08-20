"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

interface NotificationItem {
  id: string;
  type: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationList({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function open(n: NotificationItem) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    }
    router.push(n.link);
    router.refresh();
  }

  async function markAllRead() {
    setBusy(true);
    await fetch("/api/notifications/read-all", { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  if (notifications.length === 0) {
    return (
      <div className="card py-14 text-center text-sm text-stone-400">아직 알림이 없습니다.</div>
    );
  }

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={markAllRead}
            disabled={busy}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            {busy ? "처리 중..." : `안 읽음 ${unreadCount}개 모두 읽음 처리`}
          </button>
        </div>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => open(n)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition hover:border-brand-300 ${
                n.read ? "border-stone-200 bg-white" : "border-brand-200 bg-brand-50/60"
              }`}
            >
              <p
                className={`text-sm leading-6 ${
                  n.read ? "text-stone-500" : "font-semibold text-stone-800"
                }`}
              >
                {!n.read && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />}
                {n.message}
              </p>
              <p className="mt-0.5 text-xs text-stone-400">{formatDateTime(n.createdAt)}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

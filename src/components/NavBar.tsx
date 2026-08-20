import Link from "next/link";
import SignOutButton from "./SignOutButton";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "모모필라테스";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "관리자",
  INSTRUCTOR: "강사",
  MEMBER: "회원",
};

export default function NavBar({ user }: { user: { name: string; role: string } }) {
  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-stone-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-base text-white">
            🧘
          </span>
          <span className="text-[15px]">{APP_NAME}</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/notices"
            className="font-semibold text-stone-600 hover:text-brand-600"
          >
            📢 공지
          </Link>
          <span className="hidden text-stone-500 sm:inline">
            {user.name}
            <span className="ml-1 badge bg-brand-50 text-brand-700">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          </span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import KakaoProvider from "next-auth/providers/kakao";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    ...(process.env.KAKAO_CLIENT_ID
      ? [
          KakaoProvider({
            clientId: process.env.KAKAO_CLIENT_ID,
            clientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
          }),
        ]
      : []),
    CredentialsProvider({
      name: "전화번호 로그인",
      credentials: {
        phone: { label: "전화번호", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.password) return null;
        const phone = credentials.phone.replace(/\D/g, "");
        const user = await prisma.user.findUnique({ where: { phone } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider === "kakao") {
        const kakaoId = account.providerAccountId;
        const existing = await prisma.user.findUnique({ where: { kakaoId } });
        if (!existing) {
          // 카카오 최초 로그인: 회원으로 바로 사용 가능
          // (강사는 전화번호 가입으로 신청 → 원장님 승인)
          await prisma.user.create({
            data: {
              kakaoId,
              name: user.name ?? "카카오 회원",
              role: "MEMBER",
              status: "ACTIVE",
              memberProfile: { create: { startedAt: new Date() } },
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, account, user }) {
      if (account?.provider === "kakao") {
        const dbUser = await prisma.user.findUnique({
          where: { kakaoId: account.providerAccountId },
        });
        if (dbUser) token.uid = dbUser.id;
      } else if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        const dbUser = await prisma.user.findUnique({ where: { id: token.uid } });
        if (dbUser) {
          session.user = {
            id: dbUser.id,
            name: dbUser.name,
            role: dbUser.role as "ADMIN" | "INSTRUCTOR" | "MEMBER",
            status: dbUser.status as "ACTIVE" | "PENDING",
          };
        }
      }
      return session;
    },
  },
};

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

// 회원 상세 페이지 접근 권한: 관리자, 담당 강사, 본인
export function canViewMember(
  user: { id: string; role: string },
  member: { userId: string; instructorId: string | null }
) {
  if (user.role === "ADMIN") return true;
  if (user.role === "INSTRUCTOR" && member.instructorId === user.id) return true;
  return member.userId === user.id;
}

// 콘텐츠 작성(업로드/차트/수업기록) 권한: 관리자, 담당 강사
export function canManageMember(
  user: { id: string; role: string },
  member: { instructorId: string | null }
) {
  if (user.role === "ADMIN") return true;
  return user.role === "INSTRUCTOR" && member.instructorId === user.id;
}

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const phone = (process.env.ADMIN_PHONE ?? "01000000000").replace(/\D/g, "");
  const password = process.env.ADMIN_PASSWORD ?? "admin1234!";
  const name = process.env.ADMIN_NAME ?? "원장님";

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    console.log(`관리자 계정이 이미 존재합니다: ${phone}`);
    return;
  }

  await prisma.user.create({
    data: {
      name,
      phone,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log("관리자 계정이 생성되었습니다.");
  console.log(`  전화번호: ${phone}`);
  console.log(`  비밀번호: ${password}`);
  console.log("로그인 후 반드시 비밀번호를 변경하세요.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

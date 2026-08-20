"use client";

import { useState } from "react";
import EditUserDialog, { type EditableUser } from "./EditUserDialog";

interface InstructorRow {
  id: string;
  name: string;
  phone: string;
  memberCount: number;
}

export default function InstructorList({ instructors }: { instructors: InstructorRow[] }) {
  const [editing, setEditing] = useState<EditableUser | null>(null);

  return (
    <section className="card">
      <h2 className="mb-3 font-bold text-stone-900">강사 현황</h2>
      {instructors.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-400">
          등록된 강사가 없습니다. 강사님께 가입을 안내해 주세요.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {instructors.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3"
            >
              <div>
                <div className="text-sm font-semibold text-stone-800">{i.name} 강사</div>
                <div className="text-xs text-stone-400">{i.phone}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="badge bg-brand-50 text-brand-700">담당 {i.memberCount}명</span>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      userId: i.id,
                      name: i.name,
                      phone: i.phone,
                      role: "INSTRUCTOR",
                    })
                  }
                  className="text-xs font-semibold text-stone-400 hover:text-brand-600"
                >
                  수정
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditUserDialog user={editing} instructors={[]} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}

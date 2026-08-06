"""클릭해서 쓰는 창 (GUI).

터미널에 명령어를 치는 대신, 키워드를 입력하고 사진 폴더를 고르고
버튼을 누르면 됩니다.

tkinter 는 파이썬에 기본 포함이라 추가 설치가 없습니다. 리눅스 일부 배포판에서만
python3-tk 패키지가 따로 필요합니다.

작업은 별도 스레드에서 돌립니다 — 네트워크 호출이 몇 초 걸리는데 메인 스레드에서
하면 창이 '응답 없음' 으로 얼어붙기 때문입니다. 스레드에서 위젯을 직접 건드리면
안 되므로, 진행 상황은 큐에 넣고 메인 스레드가 주기적으로 꺼내 화면에 씁니다.
"""

from __future__ import annotations

import queue
import subprocess
import sys
import threading
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox
except ImportError as exc:  # pragma: no cover - 환경에 따라 tk 가 없을 수 있다
    raise SystemExit(
        "이 컴퓨터의 파이썬에 tkinter 가 없습니다.\n"
        "  Windows/macOS: 보통 기본 포함입니다. 파이썬을 python.org 버전으로 다시 설치해보세요.\n"
        "  Ubuntu/Debian: sudo apt install python3-tk\n"
        f"  (원인: {exc})"
    ) from exc

from tkinter import ttk

from .audit import audit
from .config import Settings
from .context import PostContext
from .draft import generate_draft
from .images import ImageReport, process_images
from .render import write_package
from .research import build_plan
from .theme import FlatButton, FlatEntry, apply_theme

_MARGIN = 28

# 매장 정보 입력칸. (필드명, 라벨, 예시)
_SHOP_FIELDS = [
    ("shop_name", "업체명", "예) 000헤어"),
    ("location", "위치", "예) 풍암동 월드컵경기장 근처"),
    ("service", "받은 시술 / 메뉴", "예) 뿌리매직 + 클리닉"),
    ("price", "가격", "예) 12만원 (클리닉 포함)"),
    ("duration", "걸린 시간", "예) 3시간 30분"),
    ("hours", "영업시간", "예) 10시~20시, 화요일 휴무"),
    ("parking", "주차", "예) 건물 지하 2시간 무료"),
    ("visit_reason", "방문 계기", "예) 머리 길어서 아침마다 힘들었음"),
    ("liked", "좋았던 점", "예) 손상도 먼저 봐주고 상담이 꼼꼼했다"),
    ("disliked", "아쉬웠던 점", "예) 예약 없이 가서 40분 기다렸다"),
]


def _open_folder(path: Path) -> None:
    """탐색기/파인더로 폴더 열기."""
    try:
        if sys.platform == "win32":
            subprocess.run(["explorer", str(path)], check=False)
        elif sys.platform == "darwin":
            subprocess.run(["open", str(path)], check=False)
        else:
            subprocess.run(["xdg-open", str(path)], check=False)
    except OSError:
        pass


class App:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.palette, self.fonts = apply_theme(root)
        self.root.title("네이버 블로그 글 만들기")
        self.root.geometry("1060x760")
        self.root.minsize(940, 660)

        self.messages: queue.Queue[tuple[str, object]] = queue.Queue()
        self.image_dir: Path | None = None
        self.result_dir: Path | None = None
        self.running = False
        self.shop_vars: dict[str, tk.StringVar] = {}
        self.stance_var = tk.StringVar(value="customer")

        self._build_widgets()
        self._check_keys()
        self.root.after(100, self._drain_queue)

    # -- 화면 구성 ---------------------------------------------------------
    def _build_widgets(self) -> None:
        p, f = self.palette, self.fonts

        outer = tk.Frame(self.root, bg=p.bg)
        outer.pack(fill="both", expand=True, padx=_MARGIN, pady=(20, 20))
        outer.columnconfigure(0, weight=0, minsize=420)
        outer.columnconfigure(1, weight=1)
        outer.rowconfigure(1, weight=1)

        # ---- 머리말 ----
        header = tk.Frame(outer, bg=p.bg)
        header.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 18))
        tk.Label(
            header, text="네이버 블로그 글 만들기", font=f.title, bg=p.bg, fg=p.text, anchor="w"
        ).pack(anchor="w")
        tk.Label(
            header,
            text="정보를 넣으면 발행 직전까지 만들어 드립니다. 발행은 직접 하세요.",
            font=f.hint,
            bg=p.bg,
            fg=p.text_muted,
            anchor="w",
        ).pack(anchor="w", pady=(3, 0))

        # ---- 왼쪽: 입력 (스크롤) ----
        left = tk.Frame(outer, bg=p.bg)
        left.grid(row=1, column=0, sticky="nsew", padx=(0, 22))
        left.rowconfigure(0, weight=1)
        left.columnconfigure(0, weight=1)

        canvas = tk.Canvas(left, bg=p.bg, highlightthickness=0, bd=0)
        canvas.grid(row=0, column=0, sticky="nsew")
        inputs_scroll = ttk.Scrollbar(left, orient="vertical", command=canvas.yview)
        inputs_scroll.grid(row=0, column=1, sticky="ns")
        canvas.configure(yscrollcommand=inputs_scroll.set)

        form = tk.Frame(canvas, bg=p.bg)
        window_id = canvas.create_window((0, 0), window=form, anchor="nw")
        form.columnconfigure(0, weight=1)

        def _resize_form(_event=None) -> None:
            canvas.itemconfigure(window_id, width=canvas.winfo_width())
            canvas.configure(scrollregion=canvas.bbox("all"))

        form.bind("<Configure>", _resize_form)
        canvas.bind("<Configure>", _resize_form)
        # 마우스 휠로 스크롤. 리눅스는 Button-4/5 로 온다.
        canvas.bind_all("<MouseWheel>", lambda e: canvas.yview_scroll(-e.delta // 120, "units"))
        canvas.bind_all("<Button-4>", lambda _e: canvas.yview_scroll(-1, "units"))
        canvas.bind_all("<Button-5>", lambda _e: canvas.yview_scroll(1, "units"))

        self._build_form(form)

        # ---- 오른쪽: 실행 + 로그 ----
        right = tk.Frame(outer, bg=p.bg)
        right.grid(row=1, column=1, sticky="nsew")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(2, weight=1)

        self.run_button = FlatButton(right, p, f, text="글 만들기", command=self.start)
        self.run_button.grid(row=0, column=0, sticky="ew")

        self.progress = ttk.Progressbar(
            right, mode="determinate", maximum=4, style="Accent.Horizontal.TProgressbar"
        )
        self.progress.grid(row=1, column=0, sticky="ew", pady=(14, 16))

        log_wrap = tk.Frame(right, bg=p.border)
        log_wrap.grid(row=2, column=0, sticky="nsew")
        log_inner = tk.Frame(log_wrap, bg=p.surface)
        log_inner.pack(fill="both", expand=True, padx=1, pady=1)

        self.log = tk.Text(
            log_inner,
            height=13,
            wrap="word",
            font=f.log,
            bg=p.surface,
            fg=p.text,
            relief="flat",
            bd=0,
            highlightthickness=0,
            padx=14,
            pady=12,
            spacing1=1,
            spacing3=3,
            state="disabled",
            cursor="arrow",
        )
        self.log.pack(side="left", fill="both", expand=True)

        log_scroll = ttk.Scrollbar(log_inner, orient="vertical", command=self.log.yview)
        log_scroll.pack(side="right", fill="y")
        self.log.configure(yscrollcommand=log_scroll.set)

        for tag, color in (
            ("ok", p.ok),
            ("warn", p.warn),
            ("error", p.error),
            ("info", p.info),
            ("muted", p.text_muted),
            ("faint", p.text_faint),
        ):
            self.log.tag_configure(tag, foreground=color)
        self.log.tag_configure("head", foreground=p.text, font=(f.log[0], f.log[1], "bold"))

        self.open_button = FlatButton(
            right, p, f, text="결과 폴더 열기", command=self.open_result, variant="ghost"
        )
        self.open_button.grid(row=3, column=0, sticky="ew", pady=(16, 0))
        self.open_button.set_enabled(False)

    def _build_form(self, form: tk.Frame) -> None:
        """왼쪽 입력 영역: 키워드 → 사진 → 매장 정보."""
        p, f = self.palette, self.fonts
        row = 0

        # ---- 1. 키워드 ----
        self._section_label(form, "1", "키워드").grid(row=row, column=0, sticky="ew")
        row += 1
        self.keyword_var = tk.StringVar()
        field = FlatEntry(form, p, f, self.keyword_var)
        field.grid(row=row, column=0, sticky="ew", pady=(8, 0))
        field.entry.focus_set()
        field.entry.bind("<Return>", lambda _e: self.start())
        row += 1
        tk.Label(
            form,
            text="동네 이름을 붙이면 경쟁이 적어 상위 노출이 쉽습니다   예) 풍암동미용실",
            font=f.hint,
            bg=p.bg,
            fg=p.text_faint,
            anchor="w",
            wraplength=380,
            justify="left",
        ).grid(row=row, column=0, sticky="ew", pady=(6, 20))

        # ---- 2. 사진 ----
        row += 1
        self._section_label(form, "2", "사진 폴더", optional="없어도 됩니다").grid(
            row=row, column=0, sticky="ew"
        )
        row += 1
        picker = tk.Frame(form, bg=p.surface, highlightthickness=1, highlightbackground=p.border)
        picker.grid(row=row, column=0, sticky="ew", pady=(8, 20))
        picker.columnconfigure(0, weight=1)
        self.folder_var = tk.StringVar(value="선택하지 않음")
        tk.Label(
            picker,
            textvariable=self.folder_var,
            font=f.hint,
            bg=p.surface,
            fg=p.text_muted,
            anchor="w",
            wraplength=230,
            justify="left",
        ).grid(row=0, column=0, sticky="w", padx=12, pady=10)
        FlatButton(
            picker, p, f, text="폴더 고르기", command=self.pick_folder, variant="ghost", padx=12
        ).grid(row=0, column=1, sticky="e", padx=(6, 9), pady=7)

        # ---- 3. 매장 정보 ----
        row += 1
        self._section_label(
            form, "3", "매장 정보", optional="아는 것만 채우세요"
        ).grid(row=row, column=0, sticky="ew")
        row += 1
        tk.Label(
            form,
            text="여기에 넣은 내용은 본문에 그대로 들어갑니다.\n비워두면 그 부분만 '직접 채우기' 로 남습니다.",
            font=f.hint,
            bg=p.bg,
            fg=p.text_faint,
            anchor="w",
            justify="left",
        ).grid(row=row, column=0, sticky="ew", pady=(6, 10))

        # 손님 / 사장 선택 — 말투가 완전히 달라진다
        row += 1
        stance = tk.Frame(form, bg=p.bg)
        stance.grid(row=row, column=0, sticky="ew", pady=(0, 12))
        tk.Label(stance, text="입장", font=f.section, bg=p.bg, fg=p.text).pack(side="left")
        for value, label in (("customer", "이용한 손님"), ("owner", "운영하는 사장")):
            tk.Radiobutton(
                stance,
                text=label,
                value=value,
                variable=self.stance_var,
                font=f.hint,
                bg=p.bg,
                fg=p.text,
                activebackground=p.bg,
                selectcolor=p.bg,
                highlightthickness=0,
                bd=0,
                cursor="hand2",
            ).pack(side="left", padx=(12, 0))

        for name, label, hint in _SHOP_FIELDS:
            row += 1
            var = tk.StringVar()
            self.shop_vars[name] = var
            tk.Label(
                form, text=label, font=f.section, bg=p.bg, fg=p.text, anchor="w"
            ).grid(row=row, column=0, sticky="ew", pady=(6, 0))
            row += 1
            entry = FlatEntry(form, p, f, var)
            entry.grid(row=row, column=0, sticky="ew", pady=(4, 0))
            entry.entry.configure(font=f.body)
            entry.entry.bind("<Return>", lambda _e: self.start())
            row += 1
            tk.Label(
                form, text=hint, font=f.hint, bg=p.bg, fg=p.text_faint, anchor="w"
            ).grid(row=row, column=0, sticky="ew", pady=(2, 0))

        # 자유 메모
        row += 1
        tk.Label(
            form, text="그 외 하고 싶은 말", font=f.section, bg=p.bg, fg=p.text, anchor="w"
        ).grid(row=row, column=0, sticky="ew", pady=(14, 4))
        row += 1
        memo_wrap = tk.Frame(form, bg=p.border)
        memo_wrap.grid(row=row, column=0, sticky="ew", pady=(0, 6))
        memo_inner = tk.Frame(memo_wrap, bg=p.bg)
        memo_inner.pack(fill="both", expand=True, padx=1, pady=1)
        self.memo = tk.Text(
            memo_inner,
            height=4,
            wrap="word",
            font=f.body,
            bg=p.bg,
            fg=p.text,
            insertbackground=p.text,
            relief="flat",
            bd=0,
            highlightthickness=0,
            padx=11,
            pady=9,
        )
        self.memo.pack(fill="both", expand=True)
        row += 1
        tk.Label(
            form,
            text="글에 꼭 넣고 싶은 내용을 자유롭게 적으세요.",
            font=f.hint,
            bg=p.bg,
            fg=p.text_faint,
            anchor="w",
        ).grid(row=row, column=0, sticky="ew", pady=(2, 8))

    def _collect_context(self) -> PostContext:
        values = {name: var.get().strip() for name, var in self.shop_vars.items()}
        return PostContext(
            **values,
            extra=self.memo.get("1.0", "end").strip(),
            stance=self.stance_var.get(),
        )

    def _section_label(
        self, parent: tk.Misc, number: str, text: str, *, optional: str | None = None
    ) -> tk.Frame:
        p, f = self.palette, self.fonts
        holder = tk.Frame(parent, bg=p.bg)

        badge = tk.Label(
            holder,
            text=number,
            font=(f.section[0], 9, "bold"),
            bg=p.accent,
            fg=p.accent_text,
            width=2,
            pady=1,
        )
        badge.pack(side="left")

        tk.Label(holder, text=text, font=f.section, bg=p.bg, fg=p.text).pack(
            side="left", padx=(8, 0)
        )
        if optional:
            tk.Label(holder, text=optional, font=f.hint, bg=p.bg, fg=p.text_faint).pack(
                side="left", padx=(6, 0)
            )
        return holder

    # -- 로그 -------------------------------------------------------------
    def _write(self, text: str, tag: str | None = None) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n", tag or ())
        self.log.see("end")
        self.log.configure(state="disabled")

    def _check_keys(self) -> None:
        settings = Settings.load()
        if settings.has_searchad:
            self._write("검색광고 API 키 확인됨 — 키워드 검색량을 가져옵니다.", "ok")
        else:
            self._write("검색광고 API 키가 없습니다.", "warn")
            self._write(
                "  .env 에 NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID 를 넣으면\n"
                "  키워드 검색량과 추천 키워드를 볼 수 있습니다. 없어도 글 뼈대는 만들어집니다.",
                "faint",
            )
        if settings.has_anthropic:
            self._write("Claude API 키 확인됨 — 본문 초안을 자동으로 씁니다.", "ok")
        else:
            self._write("Claude API 키가 없어 본문 초안 대신 prompt.md 가 만들어집니다.", "info")
            self._write("  그 파일 내용을 Claude 에 붙여넣으면 본문을 받을 수 있습니다.", "faint")

    # -- 동작 -------------------------------------------------------------
    def pick_folder(self) -> None:
        chosen = filedialog.askdirectory(title="사진이 들어있는 폴더를 고르세요")
        if chosen:
            self.image_dir = Path(chosen)
            self.folder_var.set(str(self.image_dir))

    def open_result(self) -> None:
        if self.result_dir and self.result_dir.exists():
            _open_folder(self.result_dir)

    def start(self) -> None:
        if self.running:
            return
        keyword = self.keyword_var.get().strip()
        if not keyword:
            messagebox.showwarning("키워드가 비어 있습니다", "쓰려는 키워드를 입력해주세요.")
            return

        context = self._collect_context()

        self.running = True
        self.run_button.set_enabled(False, text="만드는 중...")
        self.open_button.set_enabled(False)
        self.progress.configure(value=0)
        self._write("")
        self._write(f"'{keyword}' 작업을 시작합니다.", "head")

        filled = context.filled()
        if filled:
            self._write(f"  매장 정보 {len(filled)}개 항목 반영: {', '.join(filled)}", "muted")
        else:
            self._write(
                "  매장 정보를 비워두셨습니다 — 본문이 '직접 채우기' 자리로 남습니다.", "warn"
            )

        thread = threading.Thread(
            target=self._work, args=(keyword, self.image_dir, context), daemon=True
        )
        thread.start()

    def _work(self, keyword: str, image_dir: Path | None, context: PostContext) -> None:
        """별도 스레드. 위젯을 직접 건드리지 않고 큐로만 보고한다."""
        put = self.messages.put
        try:
            settings = Settings.load()

            put(("step", (1, "키워드 리서치 중...")))
            plan = build_plan(keyword, settings)
            if plan.insight.sample_size:
                put(("log", (f"  상위 {plan.insight.sample_size}개 글 분석 완료", "muted")))
            for note in plan.notes:
                put(("log", (f"  {note}", "faint")))

            images: ImageReport | None = None
            out_root = Path("out")
            if image_dir:
                put(("step", (2, "사진 최적화 중...")))
                images = process_images(
                    [image_dir], out_root / ".staging-images", keyword=keyword
                )
                put(("log", (f"  {len(images.images)}장 처리", "muted")))
                for warning in images.warnings:
                    put(("log", (f"  {warning}", "warn")))
            else:
                put(("step", (2, "사진 없음 — 건너뜁니다")))

            put(("step", (3, "본문 초안 작성 중...")))
            draft = generate_draft(plan, settings, images, context)
            if draft.generated_by == "prompt-only":
                put(("log", ("  prompt.md 를 만들었습니다 (Claude API 키 없음)", "muted")))

            report = audit(
                draft.markdown, plan, image_count=len(images.images) if images else None
            )

            put(("step", (4, "파일 정리 중...")))
            package = write_package(out_root, plan, draft, images, report)

            if images:
                final_dir = package.root / "images"
                final_dir.mkdir(exist_ok=True)
                for img in images.images:
                    target = final_dir / img.output.name
                    img.output.replace(target)
                    img.output = target
                staging = out_root / ".staging-images"
                if staging.exists() and not any(staging.iterdir()):
                    staging.rmdir()
                package = write_package(out_root, plan, draft, images, report)

            put(("done", (package.root, plan, draft.generated_by, report)))
        except Exception as exc:  # noqa: BLE001 - 창이 조용히 죽는 것보다 낫다
            put(("error", str(exc)))

    def _drain_queue(self) -> None:
        """메인 스레드에서 큐를 비우며 화면을 갱신한다."""
        try:
            while True:
                kind, payload = self.messages.get_nowait()
                if kind == "step":
                    step, text = payload  # type: ignore[misc]
                    self.progress.configure(value=step)
                    self._write(f"[{step}/4] {text}")
                elif kind == "log":
                    text, tag = payload  # type: ignore[misc]
                    self._write(text, tag)
                elif kind == "done":
                    self._finish(*payload)  # type: ignore[misc]
                elif kind == "error":
                    self._fail(str(payload))
        except queue.Empty:
            pass
        self.root.after(100, self._drain_queue)

    def _finish(self, root_dir, plan, generated_by, report) -> None:
        self.result_dir = root_dir
        self.running = False
        self.run_button.set_enabled(True, text="글 만들기")
        self.open_button.set_enabled(True)
        self.progress.configure(value=4)

        self._write("")
        self._write(f"완료 → {root_dir}", "ok")
        self._write("")
        self._write("제목 후보", "head")
        for i, title in enumerate(plan.recommended_titles, 1):
            self._write(f"  {i}. {title}")

        self._write("")
        if generated_by == "prompt-only":
            self._write("초안 대신 뼈대만 만들었으므로 품질 검사는 건너뜁니다.", "muted")
            self._write("prompt.md 내용을 Claude 에 붙여넣어 본문을 받으세요.", "muted")
        else:
            self._write(
                f"본문 {report.char_count:,}자 · 키워드 {report.keyword_count}회 "
                f"· 밀도 {report.keyword_density:.2f}%",
                "head",
            )
            for check in report.errors:
                self._write(f"  {check.label}: {check.detail}", "error")
            for check in report.warnings:
                self._write(f"  {check.label}: {check.detail}", "warn")

        self._write("")
        self._write("아래 '결과 폴더 열기' 를 누르면 파일이 있는 곳이 열립니다.", "muted")
        self._write("post.html 을 브라우저로 열어 복사 → 스마트에디터에 붙여넣으세요.", "muted")
        self._write("자동 발행은 넣지 않았습니다 (docs/naver-risk.md 참고).", "faint")

    def _fail(self, message: str) -> None:
        self.running = False
        self.run_button.set_enabled(True, text="글 만들기")
        self.progress.configure(value=0)
        self._write("")
        self._write(f"오류가 났습니다: {message}", "error")
        messagebox.showerror("오류", message)


def main() -> int:
    root = tk.Tk()
    App(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

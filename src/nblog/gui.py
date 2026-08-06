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
    from tkinter import filedialog, messagebox, scrolledtext, ttk
except ImportError as exc:  # pragma: no cover - 환경에 따라 tk 가 없을 수 있다
    raise SystemExit(
        "이 컴퓨터의 파이썬에 tkinter 가 없습니다.\n"
        "  Windows/macOS: 보통 기본 포함입니다. 파이썬을 python.org 버전으로 다시 설치해보세요.\n"
        "  Ubuntu/Debian: sudo apt install python3-tk\n"
        f"  (원인: {exc})"
    ) from exc

from .audit import audit
from .config import Settings
from .draft import generate_draft
from .images import ImageReport, process_images
from .render import write_package
from .research import build_plan

_PAD = 12


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
        self.root.title("네이버 블로그 글 만들기")
        self.root.geometry("720x620")
        self.root.minsize(600, 520)

        self.messages: queue.Queue[tuple[str, object]] = queue.Queue()
        self.image_dir: Path | None = None
        self.result_dir: Path | None = None
        self.running = False

        self._build_widgets()
        self._check_keys()
        self.root.after(100, self._drain_queue)

    # -- 화면 구성 ---------------------------------------------------------
    def _build_widgets(self) -> None:
        frame = ttk.Frame(self.root, padding=_PAD)
        frame.pack(fill="both", expand=True)
        frame.columnconfigure(1, weight=1)

        row = 0
        ttk.Label(frame, text="1. 키워드", font=("", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 4)
        )
        row += 1
        self.keyword_var = tk.StringVar()
        entry = ttk.Entry(frame, textvariable=self.keyword_var, font=("", 12))
        entry.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(0, 4))
        entry.focus_set()
        entry.bind("<Return>", lambda _e: self.start())
        row += 1
        ttk.Label(
            frame,
            text="예: 풍암동미용실 — 동네 이름을 붙이면 경쟁이 적어 상위 노출이 쉽습니다",
            foreground="#666",
        ).grid(row=row, column=0, columnspan=3, sticky="w", pady=(0, _PAD))

        row += 1
        ttk.Label(frame, text="2. 사진 폴더 (없어도 됩니다)", font=("", 11, "bold")).grid(
            row=row, column=0, sticky="w", pady=(0, 4)
        )
        row += 1
        self.folder_var = tk.StringVar(value="선택하지 않음")
        ttk.Label(frame, textvariable=self.folder_var, foreground="#666").grid(
            row=row, column=0, columnspan=2, sticky="w"
        )
        ttk.Button(frame, text="폴더 고르기", command=self.pick_folder).grid(
            row=row, column=2, sticky="e"
        )
        row += 1
        ttk.Frame(frame, height=_PAD).grid(row=row, column=0)

        row += 1
        self.run_button = ttk.Button(frame, text="글 만들기", command=self.start)
        self.run_button.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(0, 8))

        row += 1
        self.progress = ttk.Progressbar(frame, mode="determinate", maximum=4)
        self.progress.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(0, 8))

        row += 1
        self.log = scrolledtext.ScrolledText(frame, height=14, wrap="word", state="disabled")
        self.log.grid(row=row, column=0, columnspan=3, sticky="nsew")
        frame.rowconfigure(row, weight=1)

        row += 1
        self.open_button = ttk.Button(
            frame, text="결과 폴더 열기", command=self.open_result, state="disabled"
        )
        self.open_button.grid(row=row, column=0, columnspan=3, sticky="ew", pady=(8, 0))

    # -- 로그 -------------------------------------------------------------
    def _write(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def _check_keys(self) -> None:
        settings = Settings.load()
        if settings.has_searchad:
            self._write("✅ 네이버 검색광고 API 키 확인됨 — 키워드 검색량을 가져옵니다.")
        else:
            self._write(
                "⚠️  네이버 검색광고 API 키가 없습니다.\n"
                "    .env 파일에 NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY / NAVER_AD_CUSTOMER_ID 를 넣으면\n"
                "    키워드 검색량과 추천 키워드를 볼 수 있습니다. 없어도 글 뼈대는 만들어집니다."
            )
        if settings.has_anthropic:
            self._write("✅ Claude API 키 확인됨 — 본문 초안을 자동으로 씁니다.")
        else:
            self._write(
                "ℹ️  Claude API 키가 없어 본문 초안 대신 prompt.md 가 만들어집니다.\n"
                "    그 파일 내용을 Claude 에 붙여넣으면 본문을 받을 수 있습니다."
            )
        self._write("─" * 60)

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

        self.running = True
        self.run_button.configure(state="disabled", text="만드는 중...")
        self.open_button.configure(state="disabled")
        self.progress.configure(value=0)
        self._write(f"\n'{keyword}' 작업을 시작합니다.")

        thread = threading.Thread(target=self._work, args=(keyword, self.image_dir), daemon=True)
        thread.start()

    def _work(self, keyword: str, image_dir: Path | None) -> None:
        """별도 스레드. 위젯을 직접 건드리지 않고 큐로만 보고한다."""
        put = self.messages.put
        try:
            settings = Settings.load()

            put(("step", (1, "키워드 리서치 중...")))
            plan = build_plan(keyword, settings)
            if plan.insight.sample_size:
                put(("log", f"      상위 {plan.insight.sample_size}개 글 분석 완료"))
            for note in plan.notes:
                put(("log", f"      ℹ️  {note}"))

            images: ImageReport | None = None
            out_root = Path("out")
            if image_dir:
                put(("step", (2, "사진 최적화 중...")))
                images = process_images(
                    [image_dir], out_root / ".staging-images", keyword=keyword
                )
                put(("log", f"      {len(images.images)}장 처리"))
                for warning in images.warnings:
                    put(("log", f"      ⚠️  {warning}"))
            else:
                put(("step", (2, "사진 없음 — 건너뜁니다")))

            put(("step", (3, "본문 초안 작성 중...")))
            draft = generate_draft(plan, settings, images)
            if draft.generated_by == "prompt-only":
                put(("log", "      prompt.md 를 만들었습니다 (Claude API 키 없음)"))

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
                    self._write(str(payload))
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
        self.run_button.configure(state="normal", text="글 만들기")
        self.open_button.configure(state="normal")
        self.progress.configure(value=4)

        self._write(f"\n완료 → {root_dir}")
        self._write("")
        self._write("제목 후보")
        for i, title in enumerate(plan.recommended_titles, 1):
            self._write(f"  {i}. {title}")

        if generated_by == "prompt-only":
            self._write("\n초안 대신 뼈대만 만들었으므로 품질 검사는 건너뜁니다.")
            self._write("prompt.md 내용을 Claude 에 붙여넣어 본문을 받으세요.")
        else:
            self._write(
                f"\n본문 {report.char_count:,}자 · 키워드 {report.keyword_count}회 "
                f"· 밀도 {report.keyword_density:.2f}%"
            )
            for check in report.errors:
                self._write(f"  ❌ {check.label}: {check.detail}")
            for check in report.warnings:
                self._write(f"  ⚠️  {check.label}: {check.detail}")

        self._write("\n아래 '결과 폴더 열기' 를 누르면 파일이 있는 곳이 열립니다.")
        self._write("post.html 을 브라우저로 열어 복사 → 스마트에디터에 붙여넣으세요.")
        self._write("⚠️  자동 발행은 넣지 않았습니다 (docs/naver-risk.md 참고).")

    def _fail(self, message: str) -> None:
        self.running = False
        self.run_button.configure(state="normal", text="글 만들기")
        self.progress.configure(value=0)
        self._write(f"\n❌ 오류가 났습니다:\n{message}")
        messagebox.showerror("오류", message)


def main() -> int:
    root = tk.Tk()
    App(root)
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

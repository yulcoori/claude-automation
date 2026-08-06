"""브라우저에서 쓰는 웹 UI.

`nblog web` 으로 띄우면 로컬 서버가 돌고 브라우저가 열립니다.
설치 후에는 터미널을 볼 일이 없습니다.

내 컴퓨터에서만 도는 서버입니다 (127.0.0.1). 외부에서 접속할 수 없고,
사진과 API 키는 컴퓨터를 벗어나지 않습니다 — 글 생성을 위해 Claude API 로
보내는 텍스트만 예외입니다.
"""

from __future__ import annotations

import json
import shutil
import uuid
import zipfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, Response, StreamingResponse

from .audit import audit
from .config import Settings
from .context import PostContext
from .draft import DraftResult, build_prompt, stream_draft
from .images import ImageReport, process_images
from .render import write_package
from .research import PostPlan, build_plan

_HERE = Path(__file__).resolve().parent
_INDEX = _HERE / "web" / "index.html"

OUT_ROOT = Path("out")
UPLOAD_ROOT = OUT_ROOT / ".uploads"

# 브라우저가 큰 사진을 그대로 올리므로 상한을 둔다.
MAX_UPLOAD_BYTES = 30 * 1024 * 1024
MAX_UPLOAD_FILES = 60


@dataclass
class Session:
    """업로드한 사진을 생성 요청 때까지 들고 있는 자리."""

    id: str
    raw_dir: Path
    images: ImageReport | None = None
    names: list[str] = field(default_factory=list)


_sessions: dict[str, Session] = {}


def _sse(event: str, data: Any) -> str:
    """Server-Sent Events 한 줄. 브라우저가 실시간으로 받아 화면에 쓴다."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def create_app() -> FastAPI:
    app = FastAPI(title="네이버 블로그 글 만들기", docs_url=None, redoc_url=None)

    # ---- 화면 ----------------------------------------------------------
    @app.get("/", response_class=HTMLResponse)
    def index() -> HTMLResponse:
        if not _INDEX.exists():
            raise HTTPException(500, f"화면 파일을 찾을 수 없습니다: {_INDEX}")
        return HTMLResponse(_INDEX.read_text(encoding="utf-8"))

    @app.get("/favicon.ico")
    def favicon() -> Response:
        # 브라우저가 항상 요청한다. 없으면 콘솔에 404 가 남는다.
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
            '<rect width="32" height="32" rx="7" fill="#03c75a"/>'
            '<path d="M10 23V9h4l4 6.5V9h4v14h-4l-4-6.5V23z" fill="#fff"/></svg>'
        )
        return Response(svg, media_type="image/svg+xml")

    @app.get("/api/status")
    def status() -> dict:
        settings = Settings.load()
        return {
            "searchad": settings.has_searchad,
            "openapi": settings.has_openapi,
            "anthropic": settings.has_anthropic,
            "model": settings.anthropic_model if settings.has_anthropic else None,
        }

    # ---- 사진 업로드 ----------------------------------------------------
    @app.post("/api/upload")
    async def upload(files: list[UploadFile]) -> dict:
        if not files:
            raise HTTPException(400, "사진이 없습니다.")
        if len(files) > MAX_UPLOAD_FILES:
            raise HTTPException(
                400, f"사진은 한 번에 {MAX_UPLOAD_FILES}장까지 올릴 수 있습니다."
            )

        session_id = uuid.uuid4().hex[:12]
        raw_dir = UPLOAD_ROOT / session_id
        raw_dir.mkdir(parents=True, exist_ok=True)

        total = 0
        saved = 0
        for index, upload_file in enumerate(files, 1):
            data = await upload_file.read()
            total += len(data)
            if total > MAX_UPLOAD_BYTES:
                shutil.rmtree(raw_dir, ignore_errors=True)
                raise HTTPException(
                    400,
                    f"사진 전체 용량이 {MAX_UPLOAD_BYTES // 1024 // 1024}MB 를 넘습니다.",
                )
            # 업로드한 파일명을 그대로 쓰지 않는다 (경로 조작 방지).
            suffix = Path(upload_file.filename or "").suffix.lower()[:8] or ".jpg"
            (raw_dir / f"{index:03d}{suffix}").write_bytes(data)
            saved += 1

        session = Session(id=session_id, raw_dir=raw_dir)
        _sessions[session_id] = session
        return {"session": session_id, "count": saved}

    # ---- 글 만들기 ------------------------------------------------------
    @app.post("/api/generate")
    async def generate(request: Request) -> StreamingResponse:
        body = await request.json()
        keyword = str(body.get("keyword") or "").strip()
        if not keyword:
            raise HTTPException(400, "키워드를 입력해주세요.")

        context = PostContext.from_dict(body.get("context"))
        session_id = body.get("session")
        session = _sessions.get(session_id) if session_id else None

        def events():
            try:
                settings = Settings.load()

                yield _sse("step", {"n": 1, "text": "키워드 리서치 중"})
                plan: PostPlan = build_plan(keyword, settings)
                yield _sse(
                    "plan",
                    {
                        "titles": plan.recommended_titles,
                        "tags": plan.tags,
                        "sub_keywords": plan.sub_keywords,
                        "target_chars": plan.target_chars,
                        "keyword_count": plan.target_keyword_count,
                        "keywords": plan.keyword_table[:20],
                        "notes": plan.notes,
                    },
                )

                images: ImageReport | None = None
                if session:
                    yield _sse("step", {"n": 2, "text": "사진 최적화 중"})
                    images = process_images(
                        [session.raw_dir],
                        OUT_ROOT / ".staging" / session.id,
                        keyword=keyword,
                    )
                    session.images = images
                    yield _sse(
                        "images",
                        {
                            "count": len(images.images),
                            "warnings": images.warnings,
                            "duplicates": [
                                {"index": i.index, "same_as": i.duplicate_of}
                                for i in images.duplicates
                            ],
                        },
                    )
                else:
                    yield _sse("step", {"n": 2, "text": "사진 없음 — 건너뜁니다"})

                yield _sse("step", {"n": 3, "text": "본문 작성 중"})
                chunks: list[str] = []
                for chunk in stream_draft(plan, settings, images, context):
                    chunks.append(chunk)
                    yield _sse("text", {"chunk": chunk})
                markdown = "".join(chunks)

                yield _sse("step", {"n": 4, "text": "검사하고 저장 중"})
                draft = DraftResult(
                    markdown=markdown,
                    prompt=build_prompt(plan, images, context),
                    generated_by="claude" if settings.has_anthropic else "prompt-only",
                )
                report = audit(
                    markdown, plan, image_count=len(images.images) if images else None
                )
                package = write_package(OUT_ROOT, plan, draft, images, report)

                if images:
                    final_dir = package.root / "images"
                    final_dir.mkdir(exist_ok=True)
                    for img in images.images:
                        target = final_dir / img.output.name
                        if img.output.exists():
                            img.output.replace(target)
                        img.output = target
                    package = write_package(OUT_ROOT, plan, draft, images, report)
                    session.names = [i.output.name for i in images.images]

                yield _sse(
                    "done",
                    {
                        "folder": str(package.root),
                        "run": package.root.name,
                        "generated_by": draft.generated_by,
                        "chars": report.char_count,
                        "keyword_count": report.keyword_count,
                        "density": round(report.keyword_density, 2),
                        "publishable": report.publishable,
                        "checks": [
                            {"level": c.level, "label": c.label, "detail": c.detail}
                            for c in report.checks
                        ],
                        "images": session.names if session else [],
                        "html": (package.root / "post.html").read_text(encoding="utf-8"),
                    },
                )
            except Exception as exc:  # noqa: BLE001 - 브라우저에 이유를 보여준다
                yield _sse("failed", {"message": str(exc)})

        return StreamingResponse(
            events(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    # ---- 결과 내려받기 ---------------------------------------------------
    def _resolve_run(run: str) -> Path:
        """경로 조작을 막고 out/ 안의 실제 폴더만 돌려준다."""
        candidate = (OUT_ROOT / run).resolve()
        root = OUT_ROOT.resolve()
        if root not in candidate.parents or not candidate.is_dir():
            raise HTTPException(404, "결과 폴더를 찾을 수 없습니다.")
        return candidate

    @app.get("/api/image/{run}/{name}")
    def image(run: str, name: str) -> FileResponse:
        folder = _resolve_run(run)
        path = (folder / "images" / Path(name).name).resolve()
        if folder not in path.parents or not path.is_file():
            raise HTTPException(404, "사진을 찾을 수 없습니다.")
        return FileResponse(path)

    @app.get("/api/download/{run}")
    def download(run: str) -> FileResponse:
        folder = _resolve_run(run)
        archive = folder.parent / f"{folder.name}.zip"
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
            for path in sorted(folder.rglob("*")):
                if path.is_file():
                    zf.write(path, path.relative_to(folder))
        return FileResponse(
            archive, filename=f"{folder.name}.zip", media_type="application/zip"
        )

    return app


def serve(host: str = "127.0.0.1", port: int = 8765, open_browser: bool = True) -> int:
    import threading
    import webbrowser

    import uvicorn

    url = f"http://{host}:{port}/"
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    print(f"\n  네이버 블로그 글 만들기\n  브라우저에서 열기 → {url}\n")
    print("  창을 닫으려면 이 검은 창에서 Ctrl+C 를 누르세요.\n")
    uvicorn.run(create_app(), host=host, port=port, log_level="warning")
    return 0

"""GUI 색상·폰트·위젯 스타일.

tkinter 기본 모양(ttk 의 winnative/clam)은 90년대 윈도우처럼 보인다.
입체 테두리를 없애고 평면 색상과 한글 폰트를 직접 지정해 요즘 앱처럼 만든다.
"""

from __future__ import annotations

import sys
import tkinter as tk
from tkinter import font as tkfont
from tkinter import ttk


class Palette:
    """라이트 테마. 네이버 도구이므로 강조색은 네이버 그린."""

    bg = "#FFFFFF"
    surface = "#F7F8FA"
    surface_alt = "#EFF1F5"
    border = "#E1E4EA"
    border_focus = "#03C75A"

    text = "#1A1D21"
    text_muted = "#6B7280"
    text_faint = "#9AA1AC"

    accent = "#03C75A"
    accent_hover = "#02B350"
    accent_press = "#029B45"
    accent_text = "#FFFFFF"
    accent_disabled = "#B7E7CA"

    ghost_bg = "#FFFFFF"
    ghost_hover = "#F2F4F7"
    ghost_border = "#D3D8E0"

    ok = "#0F9D58"
    warn = "#B26A00"
    error = "#D93025"
    info = "#1A73E8"


def pick_family(*candidates: str) -> str:
    """설치된 폰트 중 첫 번째를 고른다. 한글이 깨지지 않는 게 최우선."""
    available = {f.lower() for f in tkfont.families()}
    for name in candidates:
        if name.lower() in available:
            return name
    return "TkDefaultFont"


class Fonts:
    def __init__(self) -> None:
        if sys.platform == "win32":
            ui = pick_family("맑은 고딕", "Malgun Gothic", "Segoe UI")
            mono = pick_family("D2Coding", "Consolas", "맑은 고딕", "Malgun Gothic")
        elif sys.platform == "darwin":
            ui = pick_family("Apple SD Gothic Neo", "AppleGothic", "Helvetica Neue")
            mono = pick_family("SF Mono", "Menlo", "Apple SD Gothic Neo")
        else:
            ui = pick_family("Noto Sans CJK KR", "NanumGothic", "DejaVu Sans")
            mono = pick_family("Noto Sans Mono CJK KR", "DejaVu Sans Mono")

        self.title = (ui, 15, "bold")
        self.section = (ui, 10, "bold")
        self.body = (ui, 10)
        self.hint = (ui, 9)
        self.input = (ui, 12)
        self.button = (ui, 11, "bold")
        self.button_small = (ui, 9)
        self.log = (mono, 9)


def apply_theme(root: tk.Tk) -> tuple[Palette, Fonts]:
    palette = Palette()
    fonts = Fonts()

    style = ttk.Style(root)
    # clam 은 색상 지정이 가장 잘 먹는 테마다. winnative 는 배경색을 무시한다.
    if "clam" in style.theme_names():
        style.theme_use("clam")

    root.configure(bg=palette.bg)

    style.configure("Card.TFrame", background=palette.bg)
    style.configure("Surface.TFrame", background=palette.surface)

    style.configure(
        "Accent.Horizontal.TProgressbar",
        troughcolor=palette.surface_alt,
        background=palette.accent,
        bordercolor=palette.surface_alt,
        lightcolor=palette.accent,
        darkcolor=palette.accent,
        thickness=6,
    )

    return palette, fonts


class FlatButton(tk.Button):
    """평면 버튼. 마우스를 올리면 색이 바뀐다.

    ttk.Button 을 쓰지 않는 이유: 플랫폼 테마가 배경색과 테두리를 덮어써서
    윈도우에서 회색 입체 버튼으로 되돌아간다.
    """

    def __init__(
        self,
        parent: tk.Misc,
        palette: Palette,
        fonts: Fonts,
        *,
        text: str,
        command=None,
        variant: str = "accent",
        **kwargs,
    ):
        self._palette = palette
        self._variant = variant

        if variant == "accent":
            bg, fg, hover, press = (
                palette.accent,
                palette.accent_text,
                palette.accent_hover,
                palette.accent_press,
            )
            font = fonts.button
            pady = 11
            border = 0
        else:
            bg, fg, hover, press = (
                palette.ghost_bg,
                palette.text,
                palette.ghost_hover,
                palette.surface_alt,
            )
            font = fonts.button_small
            pady = 7
            border = 1

        self._bg, self._hover, self._press = bg, hover, press

        super().__init__(
            parent,
            text=text,
            command=command,
            font=font,
            bg=bg,
            fg=fg,
            activebackground=press,
            activeforeground=fg,
            disabledforeground=palette.text_faint,
            relief="flat",
            bd=0,
            highlightthickness=border,
            highlightbackground=palette.ghost_border,
            highlightcolor=palette.ghost_border,
            cursor="hand2",
            pady=pady,
            **kwargs,
        )
        self.bind("<Enter>", self._on_enter, add="+")
        self.bind("<Leave>", self._on_leave, add="+")

    def _enabled(self) -> bool:
        return str(self["state"]) != "disabled"

    def _on_enter(self, _event) -> None:
        if self._enabled():
            self.configure(bg=self._hover)

    def _on_leave(self, _event) -> None:
        if self._enabled():
            self.configure(bg=self._bg)

    def set_enabled(self, enabled: bool, *, text: str | None = None) -> None:
        """비활성 상태에서도 색이 자연스럽게 보이도록 배경까지 함께 바꾼다."""
        if text is not None:
            self.configure(text=text)
        if enabled:
            self.configure(state="normal", bg=self._bg, cursor="hand2")
        else:
            disabled_bg = (
                self._palette.accent_disabled
                if self._variant == "accent"
                else self._palette.surface
            )
            self.configure(state="disabled", bg=disabled_bg, cursor="")


class FlatEntry(tk.Frame):
    """테두리가 얇고 포커스되면 강조색으로 바뀌는 입력칸."""

    def __init__(
        self,
        parent: tk.Misc,
        palette: Palette,
        fonts: Fonts,
        textvariable: tk.StringVar,
        *,
        placeholder: str = "",
    ):
        super().__init__(
            parent,
            bg=palette.border,
            highlightthickness=0,
            bd=0,
        )
        self._palette = palette
        inner = tk.Frame(self, bg=palette.bg)
        inner.pack(fill="both", expand=True, padx=1, pady=1)

        self.entry = tk.Entry(
            inner,
            textvariable=textvariable,
            font=fonts.input,
            bg=palette.bg,
            fg=palette.text,
            insertbackground=palette.text,
            relief="flat",
            bd=0,
            highlightthickness=0,
        )
        self.entry.pack(fill="both", expand=True, padx=12, pady=10)

        self.entry.bind("<FocusIn>", lambda _e: self.configure(bg=palette.border_focus), add="+")
        self.entry.bind("<FocusOut>", lambda _e: self.configure(bg=palette.border), add="+")

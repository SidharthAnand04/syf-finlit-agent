"""
Force UTF-8 (or safe replacement) on stdout/stderr before third-party code prints.

Windows consoles often use cp1252; libraries that print U+26A0 WARNING SIGN etc.
then raise UnicodeEncodeError. Import this module once at process start.
"""

from __future__ import annotations

import io
import os
import sys


class _UnicodeSafeWriteProxy:
    """Delegates to a text stream; on UnicodeEncodeError, rewrite with errors=replace."""

    __slots__ = ("_base",)

    def __init__(self, base: object) -> None:
        object.__setattr__(self, "_base", base)

    def __getattr__(self, name: str):
        return getattr(self._base, name)

    def write(self, s: str) -> int:
        base = self._base
        try:
            return base.write(s)  # type: ignore[attr-defined]
        except UnicodeEncodeError:
            enc = getattr(base, "encoding", None) or "utf-8"
            safe = s.encode(enc, errors="replace").decode(enc, errors="replace")
            return base.write(safe)  # type: ignore[attr-defined]

    def writelines(self, lines: object) -> None:
        for line in lines:  # type: ignore[union-attr]
            self.write(line)


def _try_set_windows_console_utf8() -> None:
    if sys.platform != "win32":
        return
    try:
        import ctypes

        k = ctypes.windll.kernel32
        k.SetConsoleCP(65001)
        k.SetConsoleOutputCP(65001)
    except Exception:
        pass


def apply_stdio_utf8() -> None:
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    # Python's UTF-8 mode helps on Windows when subprocesses/reloaders spawn.
    # Safe even if already enabled.
    os.environ.setdefault("PYTHONUTF8", "1")

    out, err = sys.stdout, sys.stderr
    enc_ok = ("utf-8", "utf8")

    def _ok(stream: object) -> bool:
        return (
            isinstance(stream, io.TextIOWrapper)
            and getattr(stream, "encoding", "") is not None
            and stream.encoding.lower().replace("_", "") in enc_ok
        )

    if sys.platform != "win32":
        if _ok(out) and _ok(err):
            return
        for stream in (out, err):
            if stream is not None and hasattr(stream, "reconfigure"):
                try:
                    stream.reconfigure(encoding="utf-8", errors="replace")
                except Exception:
                    pass
        return

    # Windows: code page + reconfigure before replacing wrappers (Git Bash / cp1252).
    _try_set_windows_console_utf8()

    for stream in (out, err):
        if stream is not None and hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

    if not (_ok(sys.stdout) and _ok(sys.stderr)):
        for name, linebuf in (("stdout", True), ("stderr", False)):
            stream = getattr(sys, name, None)
            if stream is None:
                continue
            if _ok(stream):
                continue
            buf = getattr(stream, "buffer", None)
            if buf is not None:
                try:
                    setattr(
                        sys,
                        name,
                        io.TextIOWrapper(
                            buf,
                            encoding="utf-8",
                            errors="replace",
                            line_buffering=linebuf,
                        ),
                    )
                except Exception:
                    if hasattr(stream, "reconfigure"):
                        try:
                            stream.reconfigure(encoding="utf-8", errors="replace")
                        except Exception:
                            pass

    # Last resort: never let ⚠ etc. crash the process if a stream is still cp1252.
    # Some libraries write to sys.__stdout__/sys.__stderr__ directly, so wrap those too.
    for name in ("stdout", "stderr", "__stdout__", "__stderr__"):
        stream = getattr(sys, name, None)
        if stream is None:
            continue
        # Avoid double-wrapping proxies (harmless, but keep it tidy).
        if isinstance(stream, _UnicodeSafeWriteProxy):
            continue
        setattr(sys, name, _UnicodeSafeWriteProxy(stream))


apply_stdio_utf8()

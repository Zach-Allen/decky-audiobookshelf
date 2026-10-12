"""Small, stable view models over Audiobookshelf's larger API payloads."""

from __future__ import annotations

from typing import Any


def _metadata(item: dict[str, Any]) -> dict[str, Any]:
    media = item.get("media") or item.get("book") or {}
    return media.get("metadata") or item.get("metadata") or {}


def item_summary(item: dict[str, Any]) -> dict[str, Any]:
    """Normalize minified, expanded, and search-result item shapes."""
    source = item.get("libraryItem") or item.get("book") or item
    metadata = _metadata(source)
    media = source.get("media") or {}
    progress = source.get("userMediaProgress") or item.get("userMediaProgress") or item.get("progress") or {}
    authors = metadata.get("authors") or []
    author = metadata.get("authorName") or metadata.get("author") or ""
    if not author and authors:
        author = ", ".join(a.get("name", "") if isinstance(a, dict) else str(a) for a in authors)

    return {
        "id": source.get("id") or item.get("libraryItemId"),
        "libraryId": source.get("libraryId"),
        "title": metadata.get("title") or source.get("name") or "Untitled",
        "subtitle": metadata.get("subtitle") or "",
        "author": author,
        "narrator": metadata.get("narratorName") or "",
        "description": metadata.get("description") or "",
        "duration": media.get("duration") or progress.get("duration") or 0,
        "currentTime": progress.get("currentTime") or 0,
        "progress": progress.get("progress") or 0,
        "isFinished": bool(progress.get("isFinished", False)),
        "hasCover": bool(media.get("coverPath") or source.get("hasCover")),
    }


def session_view(session: dict[str, Any]) -> dict[str, Any]:
    tracks = []
    for index, track in enumerate(session.get("audioTracks") or []):
        tracks.append(
            {
                "index": track.get("index", index + 1),
                "title": track.get("title") or f"Track {index + 1}",
                "contentUrl": track.get("contentUrl"),
                "startOffset": float(track.get("startOffset") or 0),
                "duration": float(track.get("duration") or 0),
            }
        )
    return {
        "id": session.get("id"),
        "libraryItemId": session.get("libraryItemId"),
        "title": session.get("displayTitle") or "Untitled",
        "author": session.get("displayAuthor") or "",
        "duration": float(session.get("duration") or 0),
        # currentTime is the field used by Audiobookshelf's own player. Older
        # servers also expose startTime, so retain it as a compatibility fallback.
        "startTime": float(
            session.get("currentTime")
            if session.get("currentTime") is not None
            else session.get("startTime") or 0
        ),
        "chapters": session.get("chapters") or [],
        "tracks": tracks,
        "playMethod": session.get("playMethod"),
    }


def chapter_at(chapters: list[dict[str, Any]], position: float) -> tuple[int, dict[str, Any] | None]:
    if not chapters:
        return -1, None
    selected = 0
    for index, chapter in enumerate(chapters):
        if float(chapter.get("start") or 0) <= position:
            selected = index
        else:
            break
    return selected, chapters[selected]

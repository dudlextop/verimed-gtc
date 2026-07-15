from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass


@dataclass(frozen=True)
class CanonicalRegion:
    code: str
    name: str
    known: bool = True


def _normalize(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).strip().casefold().replace("ё", "е")
    return re.sub(r"\s+", " ", normalized)


_REGION_ALIASES: dict[str, CanonicalRegion] = {}


def _register(code: str, name: str, *aliases: str) -> None:
    region = CanonicalRegion(code=code, name=name)
    for alias in (name, *aliases):
        _REGION_ALIASES[_normalize(alias)] = region


_register("KZ-AKM", "Акмолинская область", "Акмолинская обл.")
_register("KZ-AKT", "Актюбинская область", "Актюбинская обл.")
_register("KZ-ALA", "Алматы", "г. Алматы", "город Алматы")
_register("KZ-ALM", "Алматинская область", "Алматинская обл.")
_register("KZ-AST", "Астана", "г. Астана", "город Астана", "Нур-Султан")
_register("KZ-ATY", "Атырауская область", "Атырауская обл.")
_register(
    "KZ-VOS",
    "Восточно-Казахстанская область",
    "Восточно Казахстанская область",
    "ВКО",
)
_register("KZ-ZAP", "Западно-Казахстанская область", "Западно Казахстанская область", "ЗКО")
_register("KZ-ZHA", "Жамбылская область", "Жамбылская обл.")
_register("KZ-KAR", "Карагандинская область", "Карагандинская обл.")
_register("KZ-KUS", "Костанайская область", "Костанайская обл.")
_register("KZ-KZY", "Кызылординская область", "Кызылординская обл.")
_register("KZ-MAN", "Мангистауская область", "Мангистауская обл.")
_register("KZ-PAV", "Павлодарская область", "Павлодарская обл.")
_register("KZ-SEV", "Северо-Казахстанская область", "Северо Казахстанская область", "СКО")
_register("KZ-YUZ", "Туркестанская область", "Южно-Казахстанская область", "ЮКО")
_register("KZ-SHY", "Шымкент", "г. Шымкент", "город Шымкент")


def canonicalize_region(value: str) -> CanonicalRegion:
    """Return an explicit region match; unknown values never receive a known geometry code."""
    cleaned = " ".join(unicodedata.normalize("NFKC", value).strip().split())
    known = _REGION_ALIASES.get(_normalize(cleaned))
    if known is not None:
        return known
    digest = hashlib.sha256(_normalize(cleaned).encode("utf-8")).hexdigest()[:12]
    return CanonicalRegion(
        code=f"unknown-{digest}",
        name=cleaned or "Неизвестный регион",
        known=False,
    )

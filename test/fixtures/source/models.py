from dataclasses import dataclass
from enum import Enum
from typing import ClassVar, Optional


class TankStatus(Enum):
    EMPTY = "empty"
    FERMENTING = "fermenting"


@dataclass(frozen=True)
class Tank(BaseModel):
    """A brewing tank."""

    table: ClassVar[str] = "tanks"
    id: int
    name: str
    capacity: Optional[float] = None

    async def fill(self, litres: float = 10, *, force: bool = False) -> bool:
        """Fill the tank."""
        return True

    @staticmethod
    def parse(raw: dict) -> "Tank":
        return Tank(**raw)

    def _validate(self):
        pass


def list_tanks(session, *filters, limit: int = 50, **options) -> list[Tank]:
    return []

"""
Retry MongoDB operations on transient connection errors (AutoReconnect, ConnectionFailure).
Use for write/read operations that may fail when the connection is reset by peer.
Pass a callable that returns a coroutine so each retry runs a fresh operation.
"""
import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Import pymongo errors (Motor raises the same exceptions)
try:
    from pymongo.errors import AutoReconnect, ConnectionFailure
    RETRYABLE = (AutoReconnect, ConnectionFailure)
except ImportError:
    RETRYABLE = ()  # no retry if pymongo not available


async def with_retry(
    coro_factory: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    base_delay: float = 0.5,
) -> T:
    """
    Execute an async MongoDB operation, retrying on AutoReconnect/ConnectionFailure.
    coro_factory: callable that returns a new coroutine each time (e.g. lambda: coll.update_one(...)).
    Uses exponential backoff: base_delay, 2*base_delay, 4*base_delay.
    """
    last_exc = None
    for attempt in range(max_retries):
        try:
            return await coro_factory()
        except RETRYABLE as e:
            last_exc = e
            if attempt < max_retries - 1:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    "MongoDB connection error (attempt %d/%d), retrying in %.1fs: %s",
                    attempt + 1,
                    max_retries,
                    delay,
                    e,
                )
                await asyncio.sleep(delay)
            else:
                logger.error("MongoDB connection failed after %d attempts: %s", max_retries, e)
                raise
    raise last_exc
